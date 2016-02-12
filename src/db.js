(function(){

  window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction || {READ_WRITE: "readwrite"};
  window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
 
  var TRANSACTION_MODE = { 
      RW : 'readwrite', 
      RO: 'readonly'
  };

  var responseHandler = function(e, handler){
     var error = (e.type == 'error') ? e.target.error : null;
     handler(error, e.target.result);
  };

  var asyncResponse = function(asyncRequest){
      var request = asyncRequest();
      return {
         done: function(handler){
            var req = this.request;
            req.onsuccess = req.onerror = responseHandler(e, handler);
         }.bind({request: request})
      };
  }; 

   var Store = function(name, db){
        this.db = db;
        this.name = name;
   };

   Store.prototype = {
        add : function(item){
            return this._request(function(){ 
              return this._store(TRANSACTION_MODE.RW).add(item); 
            });
        },
        get : function(key){
            return this._request(function(){ 
              return this._store(TRANSACTION_MODE.RO).get(key);
            });
        },
        clear: function(){
           return this._request(function(){ 
              return this._store(TRANSACTION_MODE.RW).clear();
           });
        },
        remove: function(index){
           return this._request(function(){ 
              return this._store(TRANSACTION_MODE.RW).delete(index);
           });
        },
        count: function(){
           return this._request(function(){ 
             return this._store(TRANSACTION_MODE.RO).count();
           });
        },
        _store : function(mode){
            var transaction = this.db.transaction([this.name], mode);
            return transaction.objectStore(this.name);
        },
        _request: function(request){
          return asyncResponse(request.bind(this));
        }
   };

   var DataBase = function(name, version){
        this.name = name;
        this.version = version || 1;
        this.db = null;
        this._request = {};
   };

   DataBase.prototype = {
     stores: function(stores){
        var self = this;
        self._request.onupgradeneeded = function(e){
             var db = e.target.result;
             self.db = db;
             for (var name in stores){
               db.createObjectStore(name, stores[name]);
               self[name] = new Store(name, db);
            }
        };
     },
     open: function(version){
        var self = this;
        var args = [self.name];
        if(version) args.push(version);
        
        var request = indexedDB.open.apply(indexedDB, args);
        var callback;
        ['onupgradeneeded', 'onsuccess', 'onerror'].forEach(function(action){
            request[action] = function(e){
               if(self._request[action]){
                  self._request[action](e);
               }
               if(['onsuccess', 'onerror'].indexOf(action) !== - 1){
                  if(callback) responseHandler(e, callback);
               }
            };
        });
        return {
          done: function(handler){
              callback = handler;
          }
        };
     },
     close: function(){
        var db = this.db; 
        if(db){
          db.close();
        }
     }
   }

   var db = {
        create: function(name){
            var db = new DataBase(name);
            return db;
        },
        use: function(name){
            var db = new DataBase(name);
            db._request.onsuccess = function(e){
                 var db = e.target.result;
                 this.db = db;
                 var stores = db.objectStoreNames;
                 for(var i = 0; i < stores.length; i++){
                    this[stores[i]] = new Store(name, db); 
                }
            }.bind(db);
            return db;
        },
        drop: function(name){
          return asyncResponse(function(){
             return indexedDB.deleteDatabase(name);
          });
       }   
   }
   window.idb = db;
   
})();

/* create DB */
// var db = idb.create('Persons');
// db.stores({
//     customers: { autoIncrement:true },
//     friends: { autoIncrement:true },
// });

// db.open().done(function(error, result){
//     if(error){
//         console.log(error);
//         return;
//     }
//     console.log(result);

//     //db.close(); 
//     db.friends.add({ name: 'gasko', age: 13}).done(function(error, result){
//         db.friends.get(result).done(function(error, result){
//           console.log('get', result);
//         });
//     });

//     db.friends.add({ name: 'gaskonio', age: 15}).done(function(error){
//         db.friends.count().done(function(error, result){
//           console.log('count', result);
//         });
//     });
// });

/* use DB */

//  var db = idb.use('Persons').done(function(error, result){
//     if(error){
//         console.log(error);
//         return;
//     }
//     console.log('use', result);
//     db.friends.get(1).done(function(error, result){
//       console.log('get', result);
//       db.close();
//     });

// });






