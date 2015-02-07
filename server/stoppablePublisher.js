stoppablePublisher = function( sub ) {
  var self = this;
  if ( ! self instanceof stoppablePublisher )
    throw new Error("must use 'new' to create a stoppablePublisher instance");

  self._sub = sub;
  self._name = null;
  self._handle = null;
};

stoppablePublisher.prototype._subHasId = function( id ){
  var self = this;
  var name = self._name;
  var docs = self._sub && self._sub._documents;
  return docs && _.has( docs, name ) && docs[ name ][ id ];
};

stoppablePublisher.prototype.ids = function() {
  var sub = this._sub;
  return _.keys( sub._documents && sub._documents[ this._name ] || {} );
};

stoppablePublisher.prototype._observeAndPublish = function( cursor ) {
  var self = this;
  var name = self._name;
  var sub = self._sub;
  // need a list of current ids to track removals
  var oldIds = self.ids();

  if ( self._handle )
    self._handle.stop();

  var handle = cursor.observeChanges({
    added: function( id, doc ){
      if ( self._subHasId( id ) )
        oldIds.splice( oldIds.indexOf( id ), 1);
      else
        sub.added( name, id, doc );
    },
    removed: function ( id ){
      sub.removed( name, id );
    },
    changed: function ( id, doc ){
      sub.changed( name, id, doc );
    }
  });

  // any id not found during add should be removed after each restart
  if ( sub._documents && oldIds.length ) {
    oldIds.forEach( function( id ) { sub.removed ( name, id); });
  }

  self._handle = {stop: function(){
    handle.stop();
    self._handle = null;
  }};
};

stoppablePublisher.prototype.start = function( cursor ){
  var self = this;
  var name = self._name;

  if ( cursor._cursorDescription.collectionName !== name ){
    if ( ! name )
      self._name = cursor._cursorDescription.collectionName;
    else
      throw new Error( 'stoppablePublisher can not handle cursors from different collections. ',
        name, ' to ', cursor._cursorDescription.collectionName);
  }

  self._observeAndPublish( cursor );
};

stoppablePublisher.prototype.stop = function() {
  this._handle && this._handle.stop();
  
};
