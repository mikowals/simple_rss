stoppablePublisher = function( sub ) {
  var self = this;
  if ( ! self instanceof stoppablePublisher )
    throw "must use 'new' to create a stoppablePublisher instance";
  self.sub = sub;
  self.name = null;
  self.handle = null;
};

stoppablePublisher.prototype.subHasId = function( id ){
  var name = this.name;
  var sub = this.sub;
  return sub._documents && sub._documents[ name ] && sub._documents[ name ][ id ];
};

stoppablePublisher.prototype.ids = function() {
  var sub = this.sub;
  return _.keys( sub._documents && sub._documents[ this.name ] || {} );
};


stoppablePublisher.prototype.observeAndPublish = function( cursor ) {
  var self = this;
  var name = self.name;
  var sub = self.sub;
  var oldIds = self.ids();

  self.handle = cursor.observeChanges({
    added: function( id, doc ){
      if ( self.subHasId( id ) ){
        oldIds.splice( oldIds.indexOf( id ), 1);
      } else{
        sub.added( name, id, doc );
      }
    },
    removed: function ( id ){
      sub.removed( name, id );
    },
    changed: function ( id, doc ){
      sub.changed( name, id, doc );
    }
  });

  if ( sub._documents && oldIds.length){
    oldIds.forEach( function( id ) { sub.removed ( name, id)} );
  }
};

stoppablePublisher.prototype.start = function( cursor ){
  var self = this;
  var handle = self.handle;
  var name = self.name;
  if ( handle ) handle.stop();
  if ( cursor._cursorDescription.collectionName !== name ){
    if ( ! name )
      self.name = cursor._cursorDescription.collectionName;
    else
      throw new Error( 'stoppablePublisher can not handle cursors from different collections. ',
        name, ' to ', cursor._cursorDescription.collectionName);
  }

  self.observeAndPublish( cursor );
};

stoppablePublisher.prototype.stop = function() {
  this.handle && this.handle.stop();
};
