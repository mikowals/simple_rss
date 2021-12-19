# simple_rss

An RSS news reader using Meteor, Apollo, and React.

## Getting started

Clone the repository: 

    https://github.com/mikowals/simple_rss.git

Load the modules it uses:

    yarn 

If you don't have Meteor installed get it with:

    npm i -g meteor
    
Start the server:

    meteor 

It will take 10-20 seconds but you should get console messages should tell you `Started MongoDB.`
and `App running at: http://localhost:3000/`.

You can then browse to `http://localhost:3000/` click the `feeds` link and subscribe to a news feed like `http://scripting.com/rss.xml`.  You will then see articles on the `articles` page and be able to keep adding subscriptions to any RSS feed you like.  Added feeds will remain in you local database so the next time you start the app it will have previously subscribed content.

I am not sure of the state of the RSS world anymore but this code will set up `PubSubHubBub` listeners for each subscribed feed that advertises one.  If the feed notifies of updates you will receive them in realtime. 

## Running tests

There are UI tests that can be run with:

    jest


