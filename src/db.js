(function(){

    window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction || {READ_WRITE: "readwrite"}; // This line should only be needed if it is needed to support the object's constants for older browsers
    window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;


    var DB_STATE = ['INACTIVE','PENDING','DONE'];
    var PRIVATE_METHODS = '_';
    var TRANSACTION_MODE = {
        RW : 'readwrite',
        RO: 'readonly'
    };

    var DB_VERSION = 14;

    var stateManager = {
        db: {},
        version : {
            _version : {},
            add: function(name, version){
                this._version[name] = version;
            },
            upgrade: function(name){
                var version = this._version[name] + 1;
                this._version[name] = version;
                return version;
            }
        }
    };

    var asyncErrorResponse = function(msg){
        return {
            success: function(){},
            error: function(handler){
               handler({ target :{ error: msg }});
            }
        };
    };

    var waitingAsyncRequest = function(asyncRequest){
        var ref = {};
        var requestFun  = function(){
            var request = asyncRequest();
            request.onsuccess = ref.onsuccess;
            request.onerror = ref.onerror;
        };
        return {
            request: requestFun,
            ref: {
                success: function(handler){
                    ref.onsuccess = handler;
                },
                error: function(handler){
                    ref.onerror = handler;
                }
            }
        };
    };

    var asyncResponse = function(asyncRequest, wait, errorMessage){
        if(wait){
            return waitingAsyncRequest(asyncRequest);
        }
        if(errorMessage){
            return asyncErrorResponse(errorMessage);
        }
        var request = asyncRequest();
        return {
           success: function(handler){
             this.request.onsuccess = handler;
           }.bind({request: request}),
           error: function(handler){
             this.request.onerror = handler;
           }.bind({request: request})
        };
    };

    var getStore = function(name, getDb){
        var methods = {};
        var actions = [];
        var store = new ObjectStore(name, null);
        var keys = Object.keys(ObjectStore.prototype)
                   .filter(function(item){ return item[0] != PRIVATE_METHODS});
        keys.forEach(function(name){
             methods[name] = function(){
                var args = arguments;
                var request = function(){
                    store.db = getDb();
                    return store[name].apply(store, args);
                };
                if(getDb()){
                    return asyncResponse(request);
                }
                var async = asyncResponse(request, true);
                actions.push(async.request);
                return async.ref;
            };
        });
        return {
            methods: methods,
            actions: actions
        };
   };

   var ObjectStore = function(name, db){
        this.db = db;
        this.name = name;
   };

   ObjectStore.prototype = {
        add : function(item){
            return this._getStore(TRANSACTION_MODE.RW).add(item);
        },
        get : function(key){
            return this._getStore(TRANSACTION_MODE.RO).get(key);
        },
        clear: function(){
            return this._getStore(TRANSACTION_MODE.RW).clear();
        },
        remove: function(index){
            return this._getStore(TRANSACTION_MODE.RW).delete(index);
        },
        count: function(){
            return this._getStore(TRANSACTION_MODE.RO).count();
        },
        _getStore : function(mode){
            var transaction = this.db.transaction([this.name], mode);
            return transaction.objectStore(this.name);
        }
   };

   var DataBase = function(name){
        this.db = null;
        this.name = name;
        this.version = 0;
        this.state = DB_STATE[0];
        this.stores = [];
        this.newStores = [];
        this.oldStores = [];
   };

   DataBase.prototype = {
        open: function(version){
            var self = this;
            self.state = DB_STATE[1];
            var request = indexedDB.open(this.name, version);
            request.onupgradeneeded  = function(e){
                 var db = e.target.result;
                 var newStores = self.newStores;
                 if(newStores.length){
                    newStores.forEach(function(store){
                       if(!db.objectStoreNames.contains(store.name)) {
                          db.createObjectStore(store.name, store.options);
                       }
                    });
                 }
                var oldStores = self.oldStores;
                if(oldStores.length){
                    oldStores.forEach(function(name){
                       if(db.objectStoreNames.contains(name)) {
                           db.deleteObjectStore(name);
                       }
                    });
                 }
            };
            request.onsuccess = function(e){
                self.db = e.target.result;
                self.version = self.db.version;
                stateManager.version.add(self.name, self.version);
                self.state = DB_STATE[2];
                self.stores.forEach(function(actions){
                    while(actions.length){
                       actions.shift()();
                    }
                });
            };
            request.onerror = function(e){
                console.log('error', e.target.error);
                self.state = DB_STATE[0]
            };
            return request;
        },
        store: function(name){
            var self = this;
            if(self.state == DB_STATE[0]){
                self.open(DB_VERSION);
            }
            var store = getStore(name, function(){
                return self.db;
            });
            self.stores.push(store.actions);
            return store.methods;
        },
        close: function(){
            var db = this.db;
            if(db){
                db.close();
                this.db = null;
                this.state = DB_STATE[0];
            }
        },
        createStores : function(stores){
            var self = this;

            if(self.state == DB_STATE[2]){
                var msg;
                stores.forEach(function(store){
                    if(self.getStoreNames().indexOf(store.name) !== -1){
                        msg = "try to add existing store";
                        return;
                    }
                });
                if(msg) {
                    return asyncResponse(null, null, msg);
                }
                self.db.close();
                this.newStores = stores;
                return asyncResponse(function(){
                    return self.open(stateManager.version.upgrade(self.name));
                });
            }

        },
        deleteStores : function(stores){
            var self = this;
            if(self.state == DB_STATE[2]){
                var msg;
                 stores.forEach(function(name){
                    if(self.getStoreNames().indexOf(name) === -1){
                        msg = "the store does not exist in db " + self.name;
                        return;
                    }
                 });
                 if(msg) {
                    return asyncResponse(null, null, msg);
                 }
                 self.db.close();
            }
            this.oldStores = stores;
            return asyncResponse(function(){
                 return self.open(stateManager.version.upgrade(self.name));
            });
        }
   };

   var db = {
       use: function(name){
          var db;
          if(!stateManager.db[name]){
             db = new DataBase(name);
             stateManager.db[name] = db;
          } else {
            db = stateManager.db[name];
          }
          return {
            store : db.store.bind(db)
          };
       },
       modify: function(name){
            if(stateManager.db[name]){
                stateManager.db[name].close();
            }
            var db = new DataBase(name);
            return {
                deleteStores : function(){
                    return asyncResponse(function(){
                         return self.open(stateManager.version.upgrade(self.name));
                    });
                }
            };

       },
       drop: function(name){
          return asyncResponse(function(){
             return indexedDB.deleteDatabase(name);
          });
       }
   };

   window.db1 = db;

})();

  var db;
  var openRequest = indexedDB.open("test_1");
  openRequest.onsuccess = function(e) {
     console.log("onsuccess");
     db = e.target.result;

   }

   openRequest.onerror = function(e) {
      console.log("onerror");
    }


  function getPeople() {

  	var transaction = db.transaction(["firstOS"],"readonly");
    transaction.oncomplete = function(e){
       console.log('t oncomplete', e)
    }

    transaction.onerror = function(){
      console.log('t onerror');
    }
  	var store = transaction.objectStore("firstOS1");
    var request = store.get(2);
    request.onsuccess = function(){
      console.log('r onsuccess');
    }
    request.onerror = function(){
      console.log('r onerror');
    }
  }
