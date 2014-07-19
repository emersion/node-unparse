unparse
=======

An open-source clone of Parse, using MongoDB as database and implemented with Node.js.

See https://www.parse.com/docs/rest for the REST API documentation. Unparse should be compatible with it and existing Parse SDKs (e.g. with the [Javascript SDK](https://parse.com/docs/js_guide)).

Features
--------

- [x] Creating objects
- [x] Updating objects
- [x] Deleting objects
- [x] Querying objects (basic support)
- [ ] Querying objects (query contraints)
- [ ] Querying objects (relationnal queries)
- [ ] API keys and authentication
- [ ] Access Control Lists (ACL)
- [ ] Pointers
- [ ] Users
- [ ] Roles
- [ ] Files

Under the hood
--------------

Classes are stored in the `__Class` collection, which is present by default and is not overridable.

Default classes properties are:
* `objectId`: the object unique ID (not implemented for the moment, use `_id`)
* `createdAt`: the object's creation date
* `updatedAt`: the object's last update date
* `ACL`: for Access Control Lists
