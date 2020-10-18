import { ApolloServer, gql } from 'apollo-server-express';
import { WebApp } from 'meteor/webapp';
import { Feeds, Articles } from '/imports/api/simple_rss';
import React from 'react';
import { renderToStaticMarkup, renderToNodeStream, renderToString } from 'react-dom/server';
import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client';
import { renderToStringWithData } from "@apollo/client/react/ssr";
import fetch from 'cross-fetch';
import { ArticlesPage } from '/imports/ui/articles';
import Express from 'express';
import { ServerStyleSheet } from "styled-components";
import { Meteor } from 'meteor/meteor';
import { onPageLoad } from 'meteor/server-render';
import { resolvers } from '/imports/api/server/resolvers';
import { typeDefs } from '/imports/api/server/typeDefs';
//import { WebApp } from 'meteor/webapp'
//import { makeExecutableSchema } from 'graphql-tools';

const server = new ApolloServer({typeDefs, resolvers});

server.applyMiddleware({
  app: WebApp.connectHandlers,
  path: '/graphql'
})

BrowserPolicy.content.allowOriginForAll("https://fonts.googleapis.com");
BrowserPolicy.content.allowOriginForAll("http://cdn.jsdelivr.net");
BrowserPolicy.content.allowOriginForAll("http://fonts.gstatic.com");
// We are doing this work-around because Playground sets headers and WebApp also sets headers
// Resulting into a conflict and a server side exception of "Headers already sent"
WebApp.connectHandlers.use('/graphql', (req, res) => {
  if (req.method === 'GET') {
    res.end()
  }
})

// Wrap ArticlesPage here so that we can inject it into div id='stream'.
const SSRPage = () => (
  <ApolloProvider client={client}>
    <ArticlesPage />
  </ApolloProvider>
);

const client = new ApolloClient({
  ssrMode: true,
  // Remember that this is the interface the SSR server will use to connect to the
  // API server, so we need to ensure it isn't firewalled, etc
  link: createHttpLink({
    uri: 'http://localhost:3000/graphql',
    credentials: 'same-origin',
    fetch
  }),
  cache: new InMemoryCache(),
});

const context = {};

function Html({ content, state }) {
  return (
    <html>
      <body>
        <div id="app">
        <div id="stream" dangerouslySetInnerHTML={{ __html: content }} />
        </div>
        <script dangerouslySetInnerHTML={{
          __html: `window.__APOLLO_STATE__=${JSON.stringify(state).replace(/</g, '\\u003c')};`,
        }} />
        <script type="text/javascript">__meteor_runtime_config__ = JSON.parse(decodeURIComponent("%7B%22meteorRelease%22%3A%22METEOR%401.11.1%22%2C%22gitCommitHash%22%3A%22bb321769fde9c8bc8b56634b6bda645b68c2b005%22%2C%22meteorEnv%22%3A%7B%22NODE_ENV%22%3A%22development%22%2C%22TEST_METADATA%22%3A%22%7B%7D%22%7D%2C%22PUBLIC_SETTINGS%22%3A%7B%7D%2C%22ROOT_URL%22%3A%22http%3A%2F%2Flocalhost%3A3000%2F%22%2C%22ROOT_URL_PATH_PREFIX%22%3A%22%22%2C%22autoupdate%22%3A%7B%22versions%22%3A%7B%22web.browser%22%3A%7B%22version%22%3A%228e0257585f6819aba10e11169ee3bc2c67cab729%22%2C%22versionRefreshable%22%3A%22ae09771734d39115da258a6375381c7e53ed1169%22%2C%22versionNonRefreshable%22%3A%22f83322207f3e86d097637de2df6f9f7afd4eccf7%22%7D%2C%22web.browser.legacy%22%3A%7B%22version%22%3A%22a168e054c84c72868cc1a6f00988fc3b2c2bd797%22%2C%22versionRefreshable%22%3A%22ae09771734d39115da258a6375381c7e53ed1169%22%2C%22versionNonRefreshable%22%3A%2262ad7adab0d54c9a50884b1db1d3ca4c557f00c9%22%7D%7D%2C%22autoupdateVersion%22%3Anull%2C%22autoupdateVersionRefreshable%22%3Anull%2C%22autoupdateVersionCordova%22%3Anull%2C%22appId%22%3A%221r18oa7wzul7d16y2s7u%22%7D%2C%22appId%22%3A%221r18oa7wzul7d16y2s7u%22%2C%22isModern%22%3Atrue%7D"))</script>

        <script type="text/javascript" src="/packages/meteor.js?hash=857dafb4b9dff17e29ed8498a22ea5b1a3d6b41d"></script>
        <script type="text/javascript" src="/packages/modules-runtime.js?hash=23fe92393aa44a7b01bb53a510a9cab5fb43037c"></script>
        <script type="text/javascript" src="/packages/modules.js?hash=e336d685afa2192e9de5f85810ae5c7d252dea8f"></script>
        <script type="text/javascript" src="/packages/modern-browsers.js?hash=54726531b4795563b9a80c7b5a0cd309bbcf0864"></script>
        <script type="text/javascript" src="/packages/babel-compiler.js?hash=8c5705ac79152fc21e82c438dba99009224c6cec"></script>
        <script type="text/javascript" src="/packages/ecmascript.js?hash=6aac20a70923a44476d944a4d125196412f1aa5a"></script>
        <script type="text/javascript" src="/packages/url.js?hash=d8aaa0a7f4d68b4f2fda699ee97b0bf7132cf609"></script>
        <script type="text/javascript" src="/packages/http.js?hash=153ab493724ff6c72eb371495a1d1f71e2e4a1b8"></script>
        <script type="text/javascript" src="/packages/pubsubhubbub.js?hash=003392b27dd33b4ebc3700b967f255eca3746c52"></script>
        <script type="text/javascript" src="/packages/xml2js.js?hash=56bc3797732ffd77113559c4a7d9613ecdcdcbd1"></script>
        <script type="text/javascript" src="/packages/less.js?hash=417ec01307978ca7d85dd870298e20b79ab3a9ac"></script>
        <script type="text/javascript" src="/packages/filesaver.js?hash=db74233a48ac5e838e9f43ff0ba2ac15fe434589"></script>
        <script type="text/javascript" src="/packages/browser-policy.js?hash=588491c9e27118a4f4325e7ee912b1f344164494"></script>
        <script type="text/javascript" src="/packages/ecmascript-runtime.js?hash=f47aa897b4de5ae6f0c0017bb5398dfb81681191"></script>
        <script type="text/javascript" src="/packages/babel-runtime.js?hash=c4994a0e8fd67db094a0635e8fcb0355c0cb7c1c"></script>
        <script type="text/javascript" src="/packages/promise.js?hash=bcc278416465049d96746a94376f34245ad33b8c"></script>
        <script type="text/javascript" src="/packages/fetch.js?hash=0b9fdd2f5e9d2d8b0f9d52621e86d2fdcf0b4140"></script>
        <script type="text/javascript" src="/packages/dynamic-import.js?hash=8d186dbda5a43f26f4c8df7b36e4d7fc15fbbca4"></script>
        <script type="text/javascript" src="/packages/es5-shim.js?hash=5a0c0b4a871e6831f41adcf5125f8849af0dccc6"></script>
        <script type="text/javascript" src="/packages/ecmascript-runtime-client.js?hash=c5953dc3019ce157fa142871649fc345d9c89924"></script>
        <script type="text/javascript" src="/packages/random.js?hash=d072c94358e70b22c75e95559471ca75f78e4e64"></script>
        <script type="text/javascript" src="/packages/jquery.js?hash=e59767497b83645f8e11ea4099bc92c9254a8b14"></script>
        <script type="text/javascript" src="/packages/nemo64_bootstrap-data.js?hash=4f20bbd57518c2c35d3e66b731923e22067b58c0"></script>
        <script type="text/javascript" src="/packages/nemo64_bootstrap.js?hash=47cebab0c235636f174ad2186b5b6465db34162a"></script>
        <script type="text/javascript" src="/packages/cosmos_browserify.js?hash=fb4096218e077a127447823f822789133f49d532"></script>
        <script type="text/javascript" src="/packages/mikowals_lodash.js?hash=bc360f241eda03768fd8c20ca6c2746cadf0b673"></script>
        <script type="text/javascript" src="/packages/mikowals_trim-html.js?hash=2d7f9aa9c8a870bc2011f0707174f0413c23df88"></script>
        <script type="text/javascript" src="/packages/jsx.js?hash=ab03b9a9bc9b31bc7cb99762483ffcd17b60e8b6"></script>
        <script type="text/javascript" src="/packages/tracker.js?hash=5ef67b97eaf2ca907dc38459283f2349bada6814"></script>
        <script type="text/javascript" src="/packages/base64.js?hash=d815902a305964cd5d5124cfca68a5d562f2ebab"></script>
        <script type="text/javascript" src="/packages/ejson.js?hash=18007405fd1814ce9b3b5e6b00e070ceb25ffa72"></script>
        <script type="text/javascript" src="/packages/diff-sequence.js?hash=e7fa948eeff64f908873f6c77502554d52a4d615"></script>
        <script type="text/javascript" src="/packages/geojson-utils.js?hash=574576455f62f44cc91645f1ffa25291c5570d40"></script>
        <script type="text/javascript" src="/packages/id-map.js?hash=49a2eb01ca354603f5cf6a364a3e58c5a0873e53"></script>
        <script type="text/javascript" src="/packages/mongo-id.js?hash=bf89be67790e02a065ad87c0803798c9b9be4f61"></script>
        <script type="text/javascript" src="/packages/ordered-dict.js?hash=0542cdf204403ec33348fd779911ad2b9b4e7a48"></script>
        <script type="text/javascript" src="/packages/minimongo.js?hash=0210505eceea89e11b84d8e589932f752bb0fd58"></script>
        <script type="text/javascript" src="/packages/check.js?hash=75acf7c24e10e7b3e7b30bb8ecc775fd34319ce5"></script>
        <script type="text/javascript" src="/packages/retry.js?hash=687659eb641def936a59de913280418c7d832945"></script>
        <script type="text/javascript" src="/packages/callback-hook.js?hash=6760faa220114e35df517db805f6ca0fe2b9c2ab"></script>
        <script type="text/javascript" src="/packages/ddp-common.js?hash=e155eb98000548e178b4993ea1b69407d4a547ec"></script>
        <script type="text/javascript" src="/packages/reload.js?hash=08a23b21d64945b532fa0996535f9b78f1665a34"></script>
        <script type="text/javascript" src="/packages/socket-stream-client.js?hash=50e1fc1ec576cba39c38336d2bd55ba023e60bc6"></script>
        <script type="text/javascript" src="/packages/ddp-client.js?hash=5333e09ab08c9651b0cc016f95813ab4ce075f37"></script>
        <script type="text/javascript" src="/packages/ddp.js?hash=675438ff1bf207eeda74d574359af6643aefb5fd"></script>
        <script type="text/javascript" src="/packages/ddp-server.js?hash=957d5129a2d0d54aeef0887dbb6bef7e7dfca6a2"></script>
        <script type="text/javascript" src="/packages/allow-deny.js?hash=000d79baa5a670184f6af8fb8484959967723e90"></script>
        <script type="text/javascript" src="/packages/mongo-dev-server.js?hash=923b1f5dbbe3e6636ae95b0120f9f08ed36988a7"></script>
        <script type="text/javascript" src="/packages/mongo.js?hash=36acf4c818c29ba3c4980590a08b5ba13035c3c6"></script>
        <script type="text/javascript" src="/packages/reactive-dict.js?hash=64ca3384295add528414cd5c9e59741eaa02c74b"></script>
        <script type="text/javascript" src="/packages/underscore.js?hash=a29c47e75bce51635cf7f8fcc19c4884c10291d3"></script>
        <script type="text/javascript" src="/packages/vazco_universe-html-purifier.js?hash=0ca0dbb00e252398bf2e223a87d51c865f8a32a4"></script>
        <script type="text/javascript" src="/packages/reactive-var.js?hash=594fc3b2bc4dd3630b2534679abd98ee7fffae44"></script>
        <script type="text/javascript" src="/packages/meteor-base.js?hash=29010b127daf4ebacaaf9db9b8a61487e57d7d86"></script>
        <script type="text/javascript" src="/packages/mobile-experience.js?hash=2751f9ec11102d1106042c462b340c3fcfcb1990"></script>
        <script type="text/javascript" src="/packages/session.js?hash=376b340b19473f1d9a13f084ce2aa7cf4f423568"></script>
        <script type="text/javascript" src="/packages/logging.js?hash=670ebc6630beb5985c7020a75c86bea65d1bdc51"></script>
        <script type="text/javascript" src="/packages/minifier-css.js?hash=df28475b6a4cc58f23434a6d2ed7124ddc8477ee"></script>
        <script type="text/javascript" src="/packages/standard-minifier-css.js?hash=cf9869690eff10aa4bfb5dbaec682971b2254c66"></script>
        <script type="text/javascript" src="/packages/standard-minifier-js.js?hash=bc14de2febfbe660c47e5917f00a34efe4b2f865"></script>
        <script type="text/javascript" src="/packages/shell-server.js?hash=f13a25afcd4f557a0bbf67490f97e78c5d400e73"></script>
        <script type="text/javascript" src="/packages/ddp-rate-limiter.js?hash=f9956eaa3feb7f66d0826a0668a463780815f461"></script>
        <script type="text/javascript" src="/packages/localstorage.js?hash=d871d6d03bff8eb2629ca80a2c46d012db51c518"></script>
        <script type="text/javascript" src="/packages/accounts-base.js?hash=ce6ca4ef3c72eea13010fab33ed1a7915cfcdf9d"></script>
        <script type="text/javascript" src="/packages/sha.js?hash=8636b1badb9f5126ed7938edcb2092ec0cddf708"></script>
        <script type="text/javascript" src="/packages/srp.js?hash=5c0d0090629c3d0edfadc38c63edf0c54e33fc3a"></script>
        <script type="text/javascript" src="/packages/accounts-password.js?hash=b62ca67e0a89da5f57892fcab71473ee1aed8ed9"></script>
        <script type="text/javascript" src="/packages/typescript.js?hash=bebd1b94caf89e0e4b4cb068e0d21ac3722dea40"></script>
        <script type="text/javascript" src="/packages/react-meteor-data.js?hash=9942a94137a5844551dbc2eb7886ca371cf467d1"></script>
        <script type="text/javascript" src="/packages/autoupdate.js?hash=e0af7471338a4d9cb024a28b97977648652d6f6f"></script>
        <script type="text/javascript" src="/packages/apollo.js?hash=433b9d513d691a56d9c440440ceb59058a5649ff"></script>
        <script type="text/javascript" src="/packages/static-html.js?hash=c78e13903164fad1879451985750a364e14bce33"></script>
        <script type="text/javascript" src="/packages/webapp.js?hash=b496e774bc9a1ea6ff6a4c043987ce03e96a1afa"></script>
        <script type="text/javascript" src="/packages/server-render.js?hash=dea7c4783a2b8949b1fbb78dd53475ce28b2ffa0"></script>
        <script type="text/javascript" src="/packages/livedata.js?hash=811a830b121820dfa3b755a47c2b7ecf871458ba"></script>
        <script type="text/javascript" src="/packages/hot-code-push.js?hash=406b6d93681fb93e7e4938f9ad58fd43716ba94e"></script>
        <script type="text/javascript" src="/packages/launch-screen.js?hash=8b03c50c1ca0d26c3c261c661bcbc74065194977"></script>
        <script type="text/javascript" src="/app/global-imports.js?hash=0c938c017decd0f4436764a171b437a98af7368a"></script>
        <script type="text/javascript" src="/app/app.js?hash=957989f4000f0b4fc149b94af618326cf11a4272"></script>
        <script type="text/javascript" src="/packages/service-configuration.js?hash=189547f4eefbb1e20e38ab84cebcae5677a3d94e"></script>
      </body>
    </html>
  );
}

function AppWithCache({ content, state }) {
  return (
    <>
    {<div id="stream" dangerouslySetInnerHTML={{ __html: content }} />}
    <script dangerouslySetInnerHTML={{
      __html: `window.__APOLLO_STATE__=${JSON.stringify(state).replace(/</g, '\\u003c')};`,
    }} />
    </>
  );
}

// this is faster than server-render 'onPageLoad' but lacks css and js to continue updates.
WebApp.connectHandlers.use('/articles', (req, res, next) => {

    renderToStringWithData(SSRPage({client: client})).then((content) => {
      const initialState = client.extract();
      const html = <Html content={content} state={initialState} />;
      res.writeHead(
        200,
        {'Content-Type': 'text/html'}
      );
      renderToNodeStream(html).pipe(res)
  })
});

onPageLoad(async sink => {
  const sheet = new ServerStyleSheet();
  const content = await renderToStringWithData(SSRPage({client: client}));

  const initialState = client.extract();
  const appJSX = <AppWithCache content={content} state={initialState} />;

  const htmlStream = renderToNodeStream(appJSX);
  sink.renderIntoElementById("app", htmlStream);

});
