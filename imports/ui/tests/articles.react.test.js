import React from "react";
import { Article, ArticlesPage } from "../articles";
import { ARTICLES_QUERY } from "../../api/query";
import { cleanup, MockedProvider } from "@apollo/client/testing";
import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import "babel-polyfill";
import wait from "waait";

const article1 = {
  // date equal to now necessary for text to always match.
  date: new Date().getTime(),
  source: "aPublisher",
  summary: "blah blah blah",
  link: "http://test.example.com/1",
  title: "An Interesting Article",
  _id: "abc123",
  feed_id: "feed1",
};

const article2 = {
  // date equal to now necessary for text to always match.
  date: new Date().getTime() - 5000,
  source: "unknown",
  summary: "ipso facto",
  link: "http://ipso.com/1",
  title: "An Boring Article",
  _id: "def456",
  feed_id: "feed2",
};

afterEach(() => cleanup);

it("renders accurately", async () => {
  const props = article1;

  const { container } = render(<Article {...props} />);
  expect(container).toMatchInlineSnapshot(`
    <div>
      <li
        class="section"
        id="abc123"
      >
        <div
          class="header row-fluid"
          name="source"
        >
          <h2>
            aPublisher
          </h2>
          <span
            class="spacer"
          />
          <time>
            <span>
              less than a minute ago
            </span>
          </time>
        </div>
        <div
          class="article"
        >
          <div
            class="header"
          >
            <h3>
              <a
                href="http://test.example.com/1"
              >
                An Interesting Article
              </a>
            </h3>
          </div>
          <div
            class="description"
          >
            blah blah blah
          </div>
          <div
            class="footer visible-xs"
          >
            <time>
              <span>
                less than a minute ago
              </span>
            </time>
          </div>
        </div>
      </li>
    </div>
  `);
});

it("renders a list of articles", async () => {
  const mocks = [
    {
      request: {
        query: ARTICLES_QUERY,
        variables: { userId: "nullUser" },
      },
      result: {
        data: {
          articles: [article1, article2],
        },
      },
    },
  ];

  const { container } = render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <ArticlesPage />
    </MockedProvider>
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(container.querySelectorAll("li")).toHaveLength(2);
  expect(container).toMatchInlineSnapshot(`
    <div>
      <li
        class="section"
        id="abc123"
      >
        <div
          class="header row-fluid"
          name="source"
        >
          <h2>
            aPublisher
          </h2>
          <span
            class="spacer"
          />
          <time>
            <span>
              less than a minute ago
            </span>
          </time>
        </div>
        <div
          class="article"
        >
          <div
            class="header"
          >
            <h3>
              <a
                href="http://test.example.com/1"
              >
                An Interesting Article
              </a>
            </h3>
          </div>
          <div
            class="description"
          >
            blah blah blah
          </div>
          <div
            class="footer visible-xs"
          >
            <time>
              <span>
                less than a minute ago
              </span>
            </time>
          </div>
        </div>
      </li>
      <li
        class="section"
        id="def456"
      >
        <div
          class="header row-fluid"
          name="source"
        >
          <h2>
            unknown
          </h2>
          <span
            class="spacer"
          />
          <time>
            <span>
              less than a minute ago
            </span>
          </time>
        </div>
        <div
          class="article"
        >
          <div
            class="header"
          >
            <h3>
              <a
                href="http://ipso.com/1"
              >
                An Boring Article
              </a>
            </h3>
          </div>
          <div
            class="description"
          >
            ipso facto
          </div>
          <div
            class="footer visible-xs"
          >
            <time>
              <span>
                less than a minute ago
              </span>
            </time>
          </div>
        </div>
      </li>
    </div>
  `);
});
