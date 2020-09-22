Tinytest.add("ecmascript2015-runtime-expression - Object.assign", (test) => {
  var item = Object.assign( {}, {color: 'red'});
  test.equal(item.color, 'red');
});

Tinytest.add("ecmascript2015-runtime-expression - Reflect", (test) => {
  var keys = Reflect.ownKeys({color: 'red', shape: 'square'});
  test.equal(keys.length, 2);
  test.equal(keys[0],'color');
  test.equal(keys[1],'shape');
});

Tinytest.add("ecmascript2015-runtime-expression - Set", (test) => {
  var set = new Set(['a','b']);
  test.equal(set.size, 2);
  set.add('a');
  test.equal(set.size, 2);
});

Tinytest.add("ecmascript2015-runtime-expression - Map", (test) => {
  var kvArray = [["key1", "value1"], ["key2", "value2"]];
	// Use the regular Map constructor to transform a 2D key-value Array into a map
	var myMap = new Map(kvArray);
	test.equal(myMap.get("key1"),'value1'); 
});