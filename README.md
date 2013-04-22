# MeteoRSS
## A simple RSS reader demo

## Get Meteor
Make sure you have the latest meteor.js version installed:

    $ curl https://install.meteor.com | /bin/sh
    $ meteor --version
    Meteor version 0.5.9

## If you don't have already - install node.js
The easiest way is using NVM (Node Version Manager):

     $ curl https://raw.github.com/creationix/nvm/master/install.sh | sh
     $ source ~/.nvm/nvm.sh
     $ nvm install v0.8
     $ nvm use 0.8
## Install the feedparser node module

and then go into the .meteor server folder to install the feedparser module this project uses:

     $ cd .meteor/local/build/server
     $ npm install feedparser
     $ cd ../../../
## Run & enjoy
Now run

    $ meteor
and checkout [http://localhost:3000](http://localhost:3000).  
Have fun there :)
