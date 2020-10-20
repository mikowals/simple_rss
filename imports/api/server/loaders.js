import DataLoader from 'dataloader';
import { Mongo } from 'meteor/mongo';
import { Articles } from '/imports/api/simple_rss';

export const countLoader = new DataLoader(keys => {
  countLoader.clearAll();
  return articleCountByKeys(keys)
}, {
  batchScheduleFn: callback => setTimeout(callback, 10)
});

const articleCountByKeys = async (keys) => {
  console.log("countByKeys keys: ", keys);
  const rawCounts = await Articles.rawCollection().aggregate([
    { $match: {feed_id: {$in: keys}} },
    { $group: { _id: "$feed_id", count: { $sum: 1 } } }
  ]);
  let results = keys.map(_ => 0);
  for await (row of rawCounts) {
    results[keys.indexOf(row._id)] = row.count;
  }
  console.log("countByKeys counts: ", results);
  return results;
}
