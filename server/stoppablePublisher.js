
stoppablePublisher = class stoppablePublisher {
  constructor(_sub) {
    _.extend(this, {
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
    let mappedKeys = _.get(self, '_sub._documents', {});
    return mappedKeys.get(self._name, []);
  }

  _observeAndPublish (cursor) {
    let self = this;
    let {_name, _sub, _handle} = self;
    // list to track ids already published but not observed after restart
    let oldIds = new Set(self.ids());
    let removedIds = new Set([]);
    let changed =  _sub.changed.bind(_sub, _name);
    let removed = _sub.removed.bind(_sub, _name)

    _handle && _handle.stop();
    let newHandle = cursor.observeChanges({
      added( id, doc ) {
        //If the id is already published but its new to the observer treat it as changed.
        if ( oldIds.has( id ) && ! removedIds.has(id)){
          oldIds.delete(id);
          //changed(id, doc);
        } else {
          _sub.added( _name, id, doc );
        }
      },
      removed,
      changed
    });
    // any id published but not found after restart needs to be removed.
    if ( _sub._documents && oldIds.size ) {
      oldIds.forEach( removed );
      //After removals oldIds are no longer necessary and misleading if kept.
      oldIds = new Set([]);
    }

    self._handle = {stop: function () {
      newHandle.stop();
      self._handle = null;
    }};
  }

  start (cursor) {
    let self = this;
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
