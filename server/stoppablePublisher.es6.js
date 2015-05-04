stoppablePublisher = class stoppablePublisher {
  constructor(_sub) {
    Object.assign(this, {
      _sub, 
      _name: null, 
      _handle: null});
  }

  _subHasId (id) {
    return !! _.get(this, '_sub._documents.' + this._name +"." +id);
  }

  ids () {
    return Reflect.ownKeys( _.get( this, '_sub._documents.' + this._name, {}));
  }

  _observeAndPublish (cursor) {
    let self = this;
    let {_name, _sub, _handle} = self; 
    let changed = lodash.partial( _sub.changed.bind(_sub), _name);
    let removed = lodash.partial( _sub.removed.bind(_sub), _name);
    // need a list of current ids to track removals
    let oldIds = new Set(self.ids());

    _handle && _handle.stop();

    let newHandle = cursor.observeChanges({
      added( id, doc ) {
        if ( oldIds.has( id ) ){
          oldIds.delete(id);
          changed(doc);
        } else
          _sub.added( _name, id, doc );
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
