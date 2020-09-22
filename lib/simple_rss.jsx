
var DAY = 1000 * 60 * 60 * 24;
var Session = new ReactiveDict();
var ReactCSSTransitionGroup = React.addons.CSSTransitionGroup;
React.initializeTouchEvents(true);

var Main = React.createClass({
  displayName: 'Main',
  propTypes: {
    feedList: React.PropTypes.arrayOf(React.PropTypes.string),
    initialPage: React.PropTypes.string.isRequired
  },
  getInitialState(){
    return {page: this.props.initialPage};
  },
  getPageText(){
    return this.state.page === 'ArticleListContainer' ?
      <ArticleListContainer feedList={this.props.feedList} /> :
      <FeedListContainer />;
  },
  handleClick(e){
    e.stopPropagation();
    e.preventDefault();
    this.setState({page: this.state.page === 'ArticleListContainer' ? 'FeedList' : 'ArticleListContainer'});
  },
  render: function(){
    return <div>
            <span onClick={this.handleClick} onTouchStart={this.handleClick}>page</span>
            {this.getPageText()}
          </div>;
  }
});

var FeedListContainer = React.createClass({
  displayName:"FeedListContainer",
  propTypes: {
    feedList: React.PropTypes.arrayOf(React.PropTypes.string),
  },
  getDefaultProps(){
    return {feedList:[]}
  },
  getInitialState(){
    return {feeds:[]};
  },

  getBeteorData(){
    var self = this;
    if (Meteor.isServer) return {};
    var initial = true;
    var feeds = [];
    this.autorun = Feeds.find({},{ sort:{title: 1}}).observeChanges({
      added(id, doc){
        doc._id = id;
        feeds.push(doc);
        if (!initial) self.setState( {feeds});
      },
      changed(){},
      removed(){}
    });
    initial = false;
    self.setState({feeds});
  },
  componentWillMount(){
    if (Meteor.isClient) this.getBeteorData();
    this.setState({feeds: Feeds.find({_id:{$in: this.props.feedList}}, {sort:{title: 1}}).fetch()});
  },
  componentWillUnmount(){
    this.autorun && this.autorun.stop();
  },
  render(){
    return <FeedList feeds={this.state.feeds}/>;
  }
});

var FeedList = React.createClass({
  displayName: "FeedList",
  propTypes: {
    feeds: React.PropTypes.arrayOf(React.PropTypes.object),
  },
  getDefaultProps(){
    return {feeds:[]}
  },
  shouldComponentUpdate(nextProps){
    return nextProps.feeds !== this.props.feeds;
  },
  renderChildren(feeds){
    return feeds.map((feed) => <Feed className="feed row" feed={feed} key={feed._id}/>);
  },
  render(){
    return (<div className="container">
      <FeedListButtons className="feedListButtons" feeds={this.props.feeds} />
      <div>
        <span className="col-xs-7 col-md-7"><h4><strong>Feed Title</strong></h4></span>
        <span className="col-xs-2 col-md-2 text-right"><h4><strong>Count</strong></h4></span>
        <span className="col-xs-3 text-right"><h4><strong>Last update</strong></h4></span>
      </div>
      <div>{this.renderChildren(this.props.feeds)}</div>
      </div>
    );
  }
});

var Feed = React.createClass({
  displayName: 'Feed',
  propTypes: {
    feed: React.PropTypes.object
  },
  shouldComponentUpdate(nextProps, nextState) {
    return this.props.feed !== nextProps.feed;
  },
  
  render(){
    var {title, url, last_date, _id} = this.props.feed;
    return <div>
      <h5 className="col-xs-8 col-md-8 pull-left">   
        <Remove _id={_id} /> {title || url}
      </h5>
      <h5 className="count col-xs-1 col-md-1 text-right">
        <FeedCount feedId={_id}/>
      </h5>
      <h5 className="lastDate time col-xs-2 col-md-3 text-right pull-right"><TimeAgo date={last_date}/></h5>
      </div>
  }
});
var FeedCount = React.createClass({
  mixins: [ReactMeteorData],
  displayName: "FeedCount",
  propTypes: {
    feedId: React.PropTypes.string
  },
  getMeteorData(){
    return {
      count: Articles.find({feed_id: this.props.feedId},{fields:{_id:1}}).count()
    };
  },
  render(){
    return <span>{this.data.count}</span>;
  }
});

var Remove = React.createClass({
  propTypes: {
    _id: React.PropTypes.string
  },
  handleClick(e){
    e.stopPropagation();
    e.preventDefault();
    Meteor.call('removeFeed', this.props._id);
  },
  render(){
    return <a onClick={this.handleClick} onTouchStart={this.handleClick}>
              <i className="glyphicon glyphicon-remove-circle"></i>
            </a>;
  }
});

var FeedListButtons = React.createClass({
  displayName: 'FeedListButtons',
  propTypes: {
    feeds: React.PropTypes.arrayOf(React.PropTypes.object)
  },
  getInitialState(){
    return {importOPML: false};
  },
  getButtons(){
    return this.state.importOPML ?
      <form className="form-inline">
        <a id="importCancel" onClick={this.handleClick} className="btn btn-link btn-sm col-sm-1 hidden-xs">Cancel</a>
        <FileHandler onComplete={this.handleClick} />
      </form> :

      <AddFeed toggleImport={this.handleClick} feeds={this.props.feeds}/>;
  },
  handleClick(e){
    e && e.stopPropagation();
    e && e.preventDefault();
    this.setState({importOPML: ! this.state.importOPML});
  },
  
  render(){
    return this.getButtons();
  }
});

var AddFeed = React.createClass({
  propTypes: {
    toggleImport: React.PropTypes.func,
    feeds: React.PropTypes.arrayOf(React.PropTypes.object)
  },
  getInitialState(){
    return({newURL: null});
  },
  addFeed(e){
    e.stopPropagation();
    e.preventDefault();
    if (! this.state.newURL) {
      alert("URL can not be empty");
      return;
    }
    Meteor.call('addFeed', {url: this.state.newURL} , (err, res) => {
      if (err) alert(err);
      else this.setState({newURL: null});
    });
  },
  setNewURL(evt){
    this.setState({newURL: evt.target.value});
  },
  render(){
    var toggleImport = this.props.toggleImport;
    return <form className="form-inline" onSubmit={this.addFeed}>
              <a id="importToggle" onClick={toggleImport} onTouchStart={toggleImport} className="btn btn-link btn-sm col-sm-1 hidden-xs">Import</a>
              <ExportOPML feeds={this.props.feeds}/>
              <span className="input-group input-group-sm col-xs-12 col-sm-9 pull-right">
                <input onChange={this.setNewURL} type="url" value={this.state.newURL} className="input-sm col-xs-12" placeholder="Feed url to add" id="feedUrl" />
                <a id="addFeed" onClick={this.addFeed} onTouchStart={this.addFeed} type="submit" className="input-group-addon btn btn-primary btn-sm">Add</a>
              </span>
            </form>;

  }
});

var ExportOPML = React.createClass({
  propTypes: {
    feeds: React.PropTypes.arrayOf(React.PropTypes.object)
  },
  handleClick(){
    var user = Meteor.user();
    var name = user && (user.username || user.emails[0].address) || null;
    var exportOPML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" + 
    "<opml version=\"1.0\">" + 
    "<head>" + 
    "<title></title>" + 
    "</head>" +
    "<body>";
    this.props.feeds.forEach( function( feed ) {
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
    return <a id="exportOPML" onClick={this.handleClick} onTouchStart={this.handleClick} className="btn btn-link btn-sm col-sm-2 hidden-xs">Export</a>
  }
});

var FileHandler = React.createClass({
  propsTypes: {
    onComplete: React.PropTypes.func
  },
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
});

var ArticleListContainer = React.createClass({
  mixins: [ReactMeteorData],
  propTypes: {
    feedList: React.PropTypes.arrayOf(React.PropTypes.string),
    initialArticleLimit: React.PropTypes.number
  },
  getDefaultProps() {
    return {
      feedList: [],
      initialArticleLimit: 10
    };
  },
  getInitialState(){
    return {
      articles: [],
      articleLimit: this.props.initialArticleLimit
    };
  },
  getMeteorData() {
    if (Meteor.isServer) return {articles: this.data.articles};
    var limit = this.state.articleLimit;
    return {
      articles: Articles.find({}, {limit, sort:{date:-1, _id:1}}).fetch()
    };
  },
  handleWaypointEnter(){
    this.setState({articleLimit: this.state.articleLimit + 20});
  },
  componentWillMount(){
    if (Meteor.isClient) return;
    var query = {feed_id: {$in: this.props.feedList}};
    var limit = this.state.articleLimit;
    this.data.articles = Articles.find(query, {limit, sort:{date:-1, _id:1}}).fetch()
  },
  render(){
    return  <div className="container">
              <ArticleList articles={this.data.articles} />
              <Waypoint 
                onEnter={this.handleWaypointEnter} 
                threshold={0.1}/>
            </div>;
  }
});
var ArticleList = React.createClass({
  displayName: 'ArticleList',
  getDefaultProps(){
    return {
      articles: []
    };
  },
  shouldComponentUpdate(nextProps){
    return nextProps.articles !== this.props.articles;
  },
  renderArticle(article){
    return <Article article={article} key={article._id}/>;
  },
  render(){
    return  <div id="stream">
              {this.props.articles.map(this.renderArticle)}
            </div>;
  } 
});

var Article = React.createClass({
  displayName: 'Article',
  propTypes: {
    article: React.PropTypes.object.isRequired
  },
  shouldComponentUpdate(nextProps) {
    return nextProps.article !== this.props.article;
  },
  render() {
    var {_id, title, source, summary, date, link} = this.props.article;
    title = title || "Link";
    function renderMarkup() { return {__html: UniHTML.purify(summary)}; };
    return  <ArticleSectionView _id={_id}>
              <ArticleSourceView source={source}>
                <TimeAgo 
                  className="hidden-xs time pull-right" 
                  date={date}/>
              </ArticleSourceView>
              <div className="article">
                <div className="header">
                  <h3>
                    <a href={link}>{title}</a>
                  </h3>
                </div>
                <div 
                  className="description" 
                  dangerouslySetInnerHTML={renderMarkup()}/>
                <ArticleFooterView>
                    <TimeAgo 
                      className="timeago" 
                      date={date}/>
                </ArticleFooterView>
              </div>
            </ArticleSectionView>;
  }
});
var ArticleSectionView = React.createClass({
  render(){
    return <div 
              id={this.props._id} 
              className="section">
                {this.props.children}
            </div>;
  }
});

var ArticleSourceView = React.createClass({
  render(){
    return <div className="header row-fluid">
              <h2>{this.props.source}</h2>
              <span className="spacer"/>
              <time>
                {this.props.children}
              </time>
            </div>;
  }
});

var ArticleFooterView = React.createClass({
  render(){
    return <div className="footer visible-xs">
              <time>
                {this.props.children}
              </time>
            </div>;
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
  shouldComponentUpdate(nextProps,nextState){
    return this.state.timeText !== nextState.timeText;
  },
  componentWillUnmount() {
    this.computation && this.computation.stop();
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
        //var articles = Articles.find({},{limit:40, sort:{date:-1, _id:1}}).fetch();
        //" + React.renderToString(<ArticleList articles={articles}/>) + "
        var loginToken = req.cookies && req.cookies['meteor_login_token'];
        var headers = req.headers;

        var context = new FastRender._Context(loginToken, { headers: headers });
        var userId = context.userId || 'nullUser';
        var feedList = Meteor.users.findOne(userId).feedList || [];
        var bodyStr = React.renderToString(<Main initialPage='ArticleListContainer' feedList={feedList} />);
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
      React.render(<Main initialPage='ArticleListContainer' />, document.body);
    });
    var feedHandle = Meteor.subscribe('feeds');
  });
}

