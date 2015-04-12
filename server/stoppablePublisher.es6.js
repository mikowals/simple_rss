class stoppablePublisher {
  constructor(sub) {
    this._sub = sub;
    this._name = null;
    this._handle = null;
  }

  _subHasId (id) {
    let name = this._name;
    let docs = this._sub && this._sub._documents;
    return docs && _.has( docs, name ) && docs[ name ][ id ];
  }

  ids () {
    let sub = this._sub;
    return Reflect.ownKeys( sub && sub._documents && sub._documents[ this._name ] || {} );
  }

  _observeAndPublish (cursor) {
    let self = this;
    let name = self._name;
    let sub = self._sub;
    // need a list of current ids to track removals
    let oldIds = new Set(self.ids());

    if ( self._handle )
      self._handle.stop();

    let handle = cursor.observeChanges({
      added( id, doc ) {
        if ( oldIds.has( id ) ){
          oldIds.delete(id);
          sub.changed(name, id, doc);
        } else
          sub.added( name, id, doc );
      },
      removed ( id ){
        sub.removed( name, id );
      },
      changed ( id, doc ){
        sub.changed( name, id, doc );
      }
    });

    // any id not found during add should be removed after each restart
    if ( sub._documents && oldIds.size ) {
      oldIds.forEach( id => sub.removed ( name, id) );
    }

    this._handle = {stop: function () {
      handle.stop();
      this._handle = null;
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

global.stoppablePublisher = stoppablePublisher;
