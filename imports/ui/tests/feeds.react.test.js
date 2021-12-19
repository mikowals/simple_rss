import React from "react";
import { cleanup, MockedProvider } from "@apollo/client/testing";
import { render, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FeedsPage, AddFeed } from "../feeds";
import { FEEDS_QUERY } from "../../api/query";
import { REMOVE_FEED, ADD_FEED } from "../../api/mutation";
import "babel-polyfill";
import wait from "waait";

const feed1 = {
  _id: "1",
  title: "a publisher",
  url: "http://blah.blah.com",
  date: new Date().getTime(),
  count: 3,
};

const feed2 = {
  _id: "2",
  title: "another publisher",
  url: "http://more.blah.com",
  date: new Date().getTime() - 2000,
  count: 4,
};

// For insertion tests the __typename fields allow apollo to generate cache ids.
const feed3 = {
  _id: "3",
  title: "some guy",
  url: "http://blah_blah.com",
  date: new Date().getTime(),
  count: 5,
  __typename: "Feed",
};

// This object is to be inserted.
// Its _id of '4' matches the return of _makeNewID mock in /.meteorMocks/index.js.
const feed4 = {
  _id: "4",
  title: "a woman",
  url: "http://again_with_the_blah.com",
  date: new Date().getTime() - 2000,
  count: 6,
  __typename: "Feed",
};

afterEach(() => cleanup);

it("renders without error", async () => {
  const mocks = [
    {
      request: {
        query: FEEDS_QUERY,
        variables: { userId: "nullUser" },
      },
      result: {
        data: {
          feeds: [feed1, feed2],
        },
      },
    },
  ];
  const { container } = render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <FeedsPage />
    </MockedProvider>
  );

  await act(wait);
  expect(container).toMatchInlineSnapshot(`
    <div>
      <form
        class="form-inline pull-right col-sm-12"
      >
        <span
          class="mt-1 col-xs-0 col-sm-0"
        />
        <span
          class="input-group input-group-sm col-xs-12 col-sm-12 pull-right"
        >
          <input
            class="input-sm col-xs-12"
            id="feedUrl"
            placeholder="http://new URL/rss.xml"
            type="url"
            value=""
          />
          <a
            class="input-group-addon btn btn-primary btn-sm pull-right"
            id="addFeed"
            type="submit"
          >
            Subscribe
          </a>
        </span>
      </form>
      <hr
        class="col-sm-12"
      />
      <span
        class="pad-top-5 col-xs-6 col-md-6"
      >
        <h4>
          <strong>
            Feed Title
          </strong>
        </h4>
      </span>
      <span
        class="col-xs-2 col-md-2 text-right"
      >
        <h4>
          <strong>
            Count
          </strong>
        </h4>
      </span>
      <span
        class="col-xs-4 text-right"
      >
        <h4>
          <strong>
            Last update
          </strong>
        </h4>
      </span>
      <div>
        <li>
          <h5
            class="col-xs-7 col-md-7 pull-left"
          >
            <a
              id="_id + _remove"
            >
              <i
                class="glyphicon glyphicon-remove-circle"
              />
            </a>
            <a
              href="http://blah.blah.com"
            >
               
              a publisher
            </a>
          </h5>
          <h5
            class="count col-xs-1 col-md-1 text-right"
          >
            <span>
              3
            </span>
          </h5>
          <h5
            class="lastDate time col-xs-2 col-md-4 text-right pull-right"
          >
            <span>
              less than a minute ago
            </span>
          </h5>
        </li>
        <li>
          <h5
            class="col-xs-7 col-md-7 pull-left"
          >
            <a
              id="_id + _remove"
            >
              <i
                class="glyphicon glyphicon-remove-circle"
              />
            </a>
            <a
              href="http://more.blah.com"
            >
               
              another publisher
            </a>
          </h5>
          <h5
            class="count col-xs-1 col-md-1 text-right"
          >
            <span>
              4
            </span>
          </h5>
          <h5
            class="lastDate time col-xs-2 col-md-4 text-right pull-right"
          >
            <span>
              less than a minute ago
            </span>
          </h5>
        </li>
      </div>
    </div>
  `);
});

it("can remove a feed", async () => {
  let mutationCalled = false;
  const mocks = [
    {
      request: {
        query: FEEDS_QUERY,
        variables: { userId: "nullUser" },
      },
      result: {
        data: {
          feeds: [feed1, feed2],
        },
      },
    },
    {
      // _id: '1' matches _id of list item clicked for removal.
      request: {
        query: REMOVE_FEED,
        variables: { id: "1" },
      },
      result: () => {
        mutationCalled = true;
        return {
          data: {
            removeFeed: { _id: "1" },
          },
        };
      },
    },
    {
      request: {
        query: FEEDS_QUERY,
        variables: { userId: "nullUser" },
      },
      result: {
        data: {
          feeds: [feed2],
        },
      },
    },
  ];
  const { container } = render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <FeedsPage />
    </MockedProvider>
  );

  await act(wait);
  const listItems = container.querySelectorAll("li");
  expect(listItems).toHaveLength(2);
  fireEvent.click(listItems[0].querySelector("i"));
  await act(wait);
  expect(mutationCalled).toBe(true);
  const listItems2 = container.querySelectorAll("li");
  expect(listItems2).toHaveLength(1);
  expect(listItems2[0].querySelector("span").textContent).toBe("4");
  await act(wait);
});

it("errors without input text", async () => {
  jest.spyOn(window, "alert").mockImplementation(() => {});
  const { container } = render(
    <MockedProvider mocks={[]} addTypename={true}>
      <AddFeed />
    </MockedProvider>
  );

  const form = container.querySelector("form");
  fireEvent.submit(form);
  await act(wait);
  expect(window.alert).toBeCalledWith("URL can not be empty");
});

it("can add a feed", async () => {
  let mutationCalled = false;
  const mocks = [
    {
      request: {
        query: FEEDS_QUERY,
        variables: { userId: "nullUser" },
      },
      result: {
        data: {
          feeds: [feed3],
        },
      },
    },
    {
      // _id: '4' matches the variables generated by mocked _makeNewID.
      request: {
        query: ADD_FEED,
        variables: { _id: "4", url: "http://another.com" },
      },
      result: () => {
        mutationCalled = true;
        return {
          data: {
            __typename: "mutation",
            addFeed: feed4,
          },
        };
      },
    },
    {
      request: {
        query: FEEDS_QUERY,
        variables: { userId: "nullUser" },
      },
      result: {
        data: {
          feeds: [feed3, feed4],
        },
      },
    },
  ];
  const { container } = render(
    <MockedProvider mocks={mocks} addTypename={true}>
      <FeedsPage />
    </MockedProvider>
  );

  await act(wait);
  const listItems = container.querySelectorAll("li");
  expect(listItems).toHaveLength(1);

  const input = container.querySelector("input");
  fireEvent.change(input, { target: { value: "http://another.com" } });
  expect(input.value).toBe("http://another.com");
  const button = container.querySelector("form").querySelector("a");
  fireEvent.click(button);
  expect(input.value).toBe("");
  await act(wait);

  expect(mutationCalled).toBe(true);
  const listItemsAfter = container.querySelectorAll("li");
  expect(listItemsAfter).toHaveLength(2);
});

// This needs tests for failing cases.
// Add duplicate url.]
