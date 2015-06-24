
var DAY = 1000 * 60 * 60 * 24;
var Session = new ReactiveDict();
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
    var self = this;
    self.computation && self.computation.stop();
    self.computation = Tracker.autorun( function() {
      self.getArticles(self.state.articleLimit + 20);
    });
  },
  componentWillMount: function(){
    var self = this;
    if (Meteor.isServer) return self.getArticles();
    self.computation = Tracker.autorun( function() {
      self.getArticles();
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
    var self = this;
    var now;
    if (Meteor.isServer){
      now = new Date();
      return self.setState({timeText: timeAgoText(now, self.props.date)});
    } else {
      self.computation = Tracker.autorun( function(c) {
        now = Session.get('now');
        self.setState({timeText: timeAgoText(now, self.props.date)});
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
        var bodyStr = React.renderToString(<ArticleList />);
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
      React.render(<ArticleList />, document.body);
    });
  });
}


