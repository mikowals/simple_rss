
var DAY = 1000 * 60 * 60 * 24;
var Session = new ReactiveDict();

var FeedList = React.createClass({
  displayName: "FeedList",
  getInitialState(){
    return {feeds:[]};
  },
  componentWillMount(){
    this.computation = Tracker.autorun( () => {
      var feeds = this.state.feeds;
      feeds = Feeds.find({},{sort:{title: 1}}).map((feed) => {
        var old = _.findWhere(feeds, feed);
        return old || feed;
      });
      this.setState({feeds})
    })
  },
  componentWillUnmount(){
    this.computation && this.computation.stop();
  },
  render(){
    var children = this.state.feeds.map((feed) => <Feed className="feed row" feed={feed} key={feed._id}/>);
    return (<div className="container">
      <FeedListButtons className="feedListButtons"/>
      <div>
        <span className="col-xs-7 col-md-7"><h4><strong>Feed Title</strong></h4></span>
        <span className="col-xs-2 col-md-2 text-right"><h4><strong>Count</strong></h4></span>
        <span className="col-xs-3 text-right"><h4><strong>Last update</strong></h4></span>
      </div>
      <div>{children}</div>
      </div>
    );
  }
});

var Feed = React.createClass({
  displayName: 'Feed',
  shouldComponentUpdate(nextProps, nextState) {
    return this.props.feed !== nextProps.feed || this.state.count !== nextState.count;
  },
  componentWillMount(){
    this.computation = Tracker.autorun(() => {
      this.setState({count: Articles.find({source: this.props.feed.title}).count()});
    });
  },
  componentWillUnmount(){
    this.computation && this.computation.stop();
  },
  render(){
    var {title, url, last_date, _id} = this.props.feed;
    return <div>
      <h5 className="col-xs-8 col-md-8 pull-left">   
        <Remove _id={_id} /> {title || url}
      </h5>
      <h5 className="count col-xs-1 col-md-1 text-right">{this.state.count}</h5>
      <h5 className="lastDate time col-xs-2 col-md-3 text-right pull-right"><TimeAgo date={last_date}/></h5>
      </div>
  }
});
var Remove = React.createClass({
  handleClick(){
    Meteor.call('removeFeed', this.props._id);
  },
  render(){
    return <a onClick={this.handleClick}>
              <i className="glyphicon glyphicon-remove-circle"></i>
            </a>;
  }
});
var Main = React.createClass({
  displayName: 'Main',
  getInitialState(){
    return {page: 'ArticleList'};
  },
  handleClick(){
    this.setState({page: this.state.page === 'ArticleList' ? 'FeedList' : 'ArticleList'});
  },
  render: function(){
    var page;
    if (this.state.page === 'ArticleList')
      page = <ArticleList />;
    else
      page = <FeedList />;
    return <div>
            <span onClick={this.handleClick} >page</span>
            {page}
          </div>;
  }
});

var FeedListButtons = React.createClass({
  displayName: 'FeedListButtons',
  getInitialState(){
    return {importOPML: false, newURL: null};
  },
  toggleImport(){
    this.setState({importOPML: ! this.state.importOPML});
  },
  
  exportOPML(){
    var user = Meteor.user();
    var name = user && (user.username || user.emails[0].address) || null;
    var exportOPML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" + 
    "<opml version=\"1.0\">" + 
    "<head>" + 
    "<title></title>" + 
    "</head>" +
    "<body>";
    console.log( exportOPML);
    Feeds.find().forEach( function( feed ) {
      exportOPML += "<outline " +
      "text=\"" + _.escape( feed.title ) + "\" " +
      "title=\"" + _.escape( feed.title ) + "\" " +
      "type=\"rss\" " +
      "xmlUrl=\"" + _.escape( feed.url ) + "\"/>";
    });
    exportOPML += "</body></opml>";
    //exportOPML = ( new window.DOMParser() ).parseFromString( exportOPML, "text/xml");
    //exportOPML = (new XMLSerializer()).serializeToString( exportOPML );
    var blob = new Blob([exportOPML], {type: "application/xml"});
    var fname = Meteor.absoluteUrl().split( "//" )[1];
    saveAs ( blob, fname + ".opml");
  },
  render(){
    var display = null;
    if (this.state.importOPML) {
      display = <form className="form-inline">
                <a id="importCancel" onClick={this.toggleImport} className="btn btn-link btn-sm col-sm-1 hidden-xs">Cancel</a>
                  <FileHandler onComplete={this.toggleImport} />
                </form>;
    } else {
      display = <form className="form-inline">
                  <a id="importToggle" onClick={this.toggleImport} className="btn btn-link btn-sm col-sm-1 hidden-xs">Import</a>
                  <a id="exportOPML" onClick={this.exportOPML} className="btn btn-link btn-sm col-sm-2 hidden-xs">Export</a>
                  <AddFeed />
                </form>;
    }

    return display;
  }
});
var AddFeed = React.createClass({
  getInitialState(){
    return {newUrl: null};
  },
  setNewURL(evt){
    this.setState({newURL: evt.target.value});
  },
  addFeed(){
    if (! this.state.newURL) {
      alert("URL can not be empty");
      return;
    }
    Meteor.call('addFeed', {url: this.state.newURL} , (err, res) => {
      if (err) alert(err);
      else this.setState({newURL: null});
    });
  },
  render(){
    return <span className="input-group input-group-sm col-xs-12 col-sm-9 pull-right">
              <input onChange={this.setNewURL} type="url" value={this.state.newURL} className="input-sm col-xs-12" placeholder="Feed url to add" id="feedUrl" />
              <a id="addFeed" onClick={this.addFeed} type="submit" className="input-group-addon btn btn-primary btn-sm">Add</a>
            </span>;
  }
});

var FileHandler = React.createClass({
  setFileName(evt){
    this.setState({file: $(evt.target)[0].files[0] });
  },
  opmlUpload(){
    this.props.onComplete && this.props.onComplete();
    var opmlFile = this.state.file;
    var fr = new FileReader();
    fr.readAsText(opmlFile);
    fr.onloadend = function(evt) {
      if (evt.target.readyState === FileReader.DONE) { // DONE == 2
        //Meteor.call( 'XML2JSparse', evt.target.result, function ( error, result ){
        $(  evt.target.result ).find( 'outline').each( function( ){
          var url = $( this ).attr("xmlUrl");
          if ( url && ! Feeds.findOne( {url: url}, {fields:{_id:1}}));
            Meteor.call('addFeed', {url: url} );
        });
      }
    }
  },
  render(){
    return <span className="input-group input-group-sm col-xs-12 col-sm-11 text-right">
              <input id="opmlFile" type="file" onChange={this.setFileName} className="col-xs-12" multiple="multiple" />
              <a id="opmlUpload" onClick={this.opmlUpload} className="input-group-addon btn btn-primary btn-sm">
                <i className="glyphicon glyphicon-upload"></i>
              </a>
            </span>;
  }
})
var ArticleList = React.createClass({
  displayName: 'ArticleList',
  
  getInitialState: function() {
    return {
      articles: [],
      articleLimit: this.props.initialArticleLimit || 10
    };
  },
  getArticles(articleLimit) {
    var articles = this.state.articles;
    articleLimit = articleLimit || this.state.articleLimit;
    articles = Articles.find({},{limit: articleLimit, sort:{date:-1, _id:1}}).map( function(article) {
      var oldArticle = _.findWhere(articles, article);
      return oldArticle || article;
    });
    console.log('setting articles state');
    this.setState({articles, articleLimit});
  },
  increaseArticleLimit(){
    this.computation && this.computation.stop();
    this.computation = Tracker.autorun( () => {
      this.getArticles(this.state.articleLimit + 20);
    });
  },
  componentWillMount: function(){
    if (Meteor.isServer) return this.getArticles();
    this.computation = Tracker.autorun( () => {
      this.getArticles();
    });
  },
  
  componentWillUnmount: function(){    
    Meteor.isClient && this.computation && this.computation.stop();
  },
  render: function(){
    var articles = this.state.articles;
    var children = articles.map( function(article) {
      return <Article article={article} key={article._id}/>;
    });
    return (<div className="container">
              <div id="stream">{children}</div>
              <Waypoint onEnter={this.increaseArticleLimit} threshold={0.1}/>
            </div>);
  } 
});

var Article = React.createClass({
  displayName: 'Article',
  shouldComponentUpdate(nextProps) {
    return nextProps.article !== this.props.article;
  },
  render() {
    var {_id, title, source, summary, date, link} = this.props.article;
    title = title || "Link";
    function createMarkup() { return {__html: UniHTML.purify(summary)}; };
    return  (<div id={_id} className="section">
              <div className="header row-fluid">
                <h2>{source}</h2>
                <span className="spacer"></span>
                <time><TimeAgo className="hidden-xs time pull-right" date={date}/></time>
              </div>
              <div className="article">
                <div className="header">
                  <h3><a href={link}>{title}</a></h3>
                </div>
                <div className="description" dangerouslySetInnerHTML={createMarkup()}/>
                <div className="footer visible-xs">
                  <time><TimeAgo className="timeago" date={date}/></time>
                </div>
              </div>
             </div>);
  }
});

var TimeAgo = React.createClass({
  displayName: 'TimeAgo',
  componentWillMount() {
    var now;
    if (Meteor.isServer){
      now = new Date();
      return this.setState({timeText: timeAgoText(now, this.props.date)});
    } else {
      this.computation = Tracker.autorun( (c) => {
        now = Session.get('now');
        this.setState({timeText: timeAgoText(now, this.props.date)});
      });
    }
  },
  componentWillUnmount() {
    this.computation && this.computation.stop();
  },
  shouldComponentUpdate(nextProps,nextState){
    return this.state.timeText !== nextState.timeText;
  },
  render() {
    return <span>{this.state.timeText}</span>;
  }
});

var timeAgoText = function( now, aDate) {
  now = new Date(now);
  aDate = new Date(aDate);
  var days = ( now -  aDate ) / DAY

  var timeText = null;
  if (Math.floor(days )  >= 2) timeText = Math.floor(days ) + " days ago";
  else if (Math.floor(days )  >= 1) timeText = Math.floor(days ) + " day ago";
  else if (Math.floor(days  * 24)  >= 2 ) timeText = Math.floor(days * 24) + " hours ago";
  else if (Math.floor(days * 24)  >= 1 ) timeText = Math.floor(days  * 24) + " hour ago";
  else if (Math.floor(days  * 24 * 60) >= 2) timeText = Math.floor(days * 24 * 60) + " minutes ago";
  else {
    timeText = "about a minute ago";
  }
  return timeText;
}

if (Meteor.isServer) {
  // add a raw connect handler for / that renders the body with react.
  WebApp.rawConnectHandlers.use(
    Meteor.bindEnvironment(function(req, res, next) {
      if (Inject.appUrl(req.url) 
        && req.url.search(/.js/) === -1 
        && req.url.search(/.map/) === -1
        && req.url.search(/\/hubbub/) === -1
      ) {
        console.log(req.url);
        //var articles = Articles.find({},{limit:40, sort:{date:-1, _id:1}}).fetch();
        //" + React.renderToString(<ArticleList articles={articles}/>) + "
        var bodyStr = React.renderToString(<Main page='ArticleList' />);
        Inject.rawHead('ssr-head', "<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>", res)
        Inject.rawBody('ssr-render', bodyStr, res);
        Inject.rawModHtml('defer scripts', function(html) {
          return html.replace(/<script/g, '<script defer');
        });
      } 
      next();
    }, 'ssr-render')
  );
} else {
  // on the client, just render to the body

  Meteor.startup( function() {
    Session.set('now',new Date());
    Meteor.setInterval( function() {
      Session.set('now',new Date());
    }, 1000 * 60);
    var subHandle = Meteor.subscribe('articles', function() {
      React.render(<Main page='ArticleList' />, document.body);
    });
    var feedHandle = Meteor.subscribe('feeds');
  });
}


