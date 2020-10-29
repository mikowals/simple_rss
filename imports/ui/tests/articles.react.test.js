import React from 'react';
import { Article } from '../articles';
import renderer from 'react-test-renderer';

test('Article renders accurately', () => {
  const props = {
    // date equal to now necessary for text to always match.
    date: (new Date()).getTime(),
    source: "aPublisher",
    summary: "blah blah blah",
    link: "http://test.example.com/1",
    title: "An Interesting Article",
    _id: "abc123"
  }

  const component = renderer.create(
    <Article {...props} />,
  );
  let tree = component.toJSON();
  expect(tree).toMatchSnapshot();
});
