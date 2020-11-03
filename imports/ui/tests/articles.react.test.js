import React from 'react';
import { Article, ArticlesPage } from '../articles';
import { ARTICLES_QUERY } from '../../api/query';
import {cleanup, MockedProvider} from '@apollo/client/testing';
import { InMemoryCache } from '@apollo/client';
import renderer, {act} from 'react-test-renderer';
import "babel-polyfill";
import wait from 'waait';

const article1 = {
  // date equal to now necessary for text to always match.
  date: (new Date()).getTime(),
  source: "aPublisher",
  summary: "blah blah blah",
  link: "http://test.example.com/1",
  title: "An Interesting Article",
  _id: "abc123",
  feed_id: "feed1",
}

const article2 = {
  // date equal to now necessary for text to always match.
  date: (new Date()).getTime() - 5000,
  source: "unknown",
  summary: "ipso facto",
  link: "http://ipso.com/1",
  title: "An Boring Article",
  _id: "def456",
  feed_id: "feed2",
}

afterEach(() => cleanup);

it('renders accurately', () => {
  const props = article1;

  const component = renderer.create(
    <Article {...props} />,
  );
  let tree = component.toJSON();
  expect(tree).toMatchSnapshot();
});

it('renders a list of articles', async () => {
  const mocks = [
    {
      request: {
        query: ARTICLES_QUERY,
        variables: {userId: "nullUser"},
      },
      result: {
        data: {
          articles: [article1, article2]
        }
      }
    }
  ]

  const component = renderer.create(
    <MockedProvider mocks={mocks} addTypename={false} >
      <ArticlesPage />
    </MockedProvider>
  );
  expect(component.root.findAllByType('li')).toHaveLength(0);
  await act(wait);
  expect(component.root.findAllByType('li')).toHaveLength(2);
  let tree = component.toJSON();
  expect(tree).toMatchSnapshot();
});
