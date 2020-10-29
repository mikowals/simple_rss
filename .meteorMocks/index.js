let usersQueryResult = [];
export function __setUsersQueryResult(result) {
  usersQueryResult = result;
}
export const Meteor = {
  users: {
    findOne: jest.fn().mockImplementation(() => usersQueryResult),
    find: jest.fn().mockImplementation(() => ({
      fetch: jest.fn().mockReturnValue(usersQueryResult),
      count: jest.fn(),
    })),
  },
};
export const Mongo = {
  Collection: jest.fn().mockImplementation(() => ({
    _ensureIndex: (jest.fn()),
    _makeNewID: (jest.fn(() => '4')),
  })),
};
