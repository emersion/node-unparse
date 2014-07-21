unparse
=======

An open-source clone of Parse, using MongoDB as database and implemented with Node.js.

See https://www.parse.com/docs/rest for the REST API documentation. Unparse should be compatible with it and existing Parse SDKs (e.g. with the [Javascript SDK](https://parse.com/docs/js_guide)).

> Warning! This software is still in an early development stage. Use only for test purposes!

Features
--------

- [x] Creating objects
- [x] Updating objects
- [x] Deleting objects
- [x] Querying objects (basic support)
- [ ] Querying objects (query contraints)
- [ ] Querying objects (relationnal queries)
- [x] API keys and authentication
- [ ] Access Control Lists (ACL)
- [ ] Users
  - [x] Signup
  - [x] Login
  - [x] Password hashing
  - [x] Retrieving current user
  - [x] Querying users
  - [x] Updating users
  - [ ] Requesting a password reset
  - [x] Deleting users
- [ ] Pointers (one-to-one)
- [ ] Relations (one-to-many)
- [ ] Roles
- [ ] Files
- [ ] Cloud functions, cloud code

Running the server
------------------

Start the server:
```
./unparse
```

Initialize the database with default classes:
```
./unparse init
```

Using Parse Javascript SDK
--------------------------

You can use the official Parse Javascript SDK ([quickstart](https://parse.com/apps/quickstart#parse_data/web)) with Unparse:
```js
Parse.serverURL = 'https://api.unparse.org'; // Change this to your Unparse server URL
Parse.initialize("appId", "javascriptKey"); // Replace with your application ID and your Javascript API key (defined in src/config/)

// You can now play around with the SDK
var TestObject = Parse.Object.extend("TestObject");
var testObject = new TestObject();
testObject.save({foo: "bar"}).then(function(object) {
  alert("yay! it worked");
});
```

> Note: we're maintaining a Bower package for the Parse JS SDK: https://github.com/unparse/parse-js-sdk
>
> You can install the SDK by running `bower install parse-sdk`.

Under the hood
--------------

Classes are stored in the `__Class` collection, which is present by default and is not overridable.

Default classes properties are:
* `objectId`: the object unique ID
* `createdAt`: the object's creation date
* `updatedAt`: the object's last update date
* `ACL`: for Access Control Lists

Currently, there is only one application per server. API credentials can be modified in `src/config/`.
