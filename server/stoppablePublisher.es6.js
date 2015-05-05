stoppablePublisher = class stoppablePublisher {
  constructor(_sub) {
    Object.assign(this, {
      _sub, 
      _name: null, 
      _handle: null});
  }

  _subHasId (id) {
    var self = this;
    return _.has(self, ['_sub', 'documents', self._name, id]);
  }

  ids () {
    var self = this;
    return Reflect.ownKeys( _.get( self, ['_sub','_documents',self._name], {}));
  }

  _observeAndPublish (cursor) {
    let self = this;
    let {_name, _sub, _handle} = self; 
    let changed = _.partial( _sub.changed.bind(_sub), _name);
    let removed = _.partial( _sub.removed.bind(_sub), _name);
    // need a list of current ids to track removals
    let oldIds = new Set(self.ids());

    _handle && _handle.stop();
    let newHandle = cursor.observeChanges({
      added( id, doc ) {
        if ( oldIds.has( id ) ){
          oldIds.delete(id);
          changed(id, doc);
        } else{
          _sub.added( _name, id, doc );
        }
      },
      removed,
      changed
    });

    // any id not found during add should be removed after each restart
    if ( _sub._documents && oldIds.size ) {
      oldIds.forEach( removed );
    }

    self._handle = {stop: function () {
      newHandle.stop();
      self._handle = null;
    }};
  }

  start (cursor) {
    var name = this._name;
    if ( cursor._cursorDescription.collectionName !== name ){
      if ( ! name )
        this._name = cursor._cursorDescription.collectionName;
      else
        throw new Error( 'stoppablePublisher can not handle cursors from different collections. ',
          name, ' to ', cursor._cursorDescription.collectionName);
    }
    this._observeAndPublish( cursor );
  }

  stop () {
    this._handle && this._handle.stop();
  }
}
