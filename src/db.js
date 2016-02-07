(function(){

	var Request = function(asyncRequest){ 
	    var request = asyncRequest();
	    return {
	       succces: function(handler){
	         this.request.onsuccess = handler;
	       }.bind({request: request})
	    }
	};

   var dbRequest = function(asyncRequest){
        var obj = {};
        var fun  = function(){
            var request = asyncRequest();
            for(var key in obj){
                request[key] = obj[key];
            }
        };
        return {
            fun: fun,
            ref: obj
        };
   };

   var getStore = function(name, getDb){
        var methods = {};
        var actions = [];
        var store = new ObjectStore(name, null);
        var keys = Object.keys(ObjectStore.prototype)
                   .filter(function(item){ return item[0] != '_'});
        keys.forEach(function(name){
             methods[name] = function(){
                var args = arguments;
                var async = function(){
                    store.db = getDb();
                    return store[name].apply(store, args);
                };
                if(getDb()){
                    return async();
                }
                var request = dbRequest(async);
                actions.push(request.fun);
                return request.ref;
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
            return this._getStore('readwrite').add(item);
        },
        get : function(key){
            return this._getStore('readonly').get(key);
        },
        clear: function(){
            return this._getStore('readwrite').clear();
        },
        delete: function(){
            return this._getStore('readwrite').delete();
        },
        count: function(){
            return this._getStore('readonly').count();
        },
        _getStore : function(mode){
            var transaction = this.db.transaction([this.name], mode);
            return transaction.objectStore(this.name);
        }
   };

    var DataBase = function(name, obj){
        this.name = name;
        this.obj = obj;
        this.db = null;
        this.handlers = ['onsuccess', 'onerror', 'onupgradeneeded'];
        this.actions = [];
        this.stores = [];
        this.open();
    };

    DataBase.prototype = {
        open: function(){
            var request = indexedDB.open(this.name, 1);
            var handlers = this.handlers;
            var self = this;
            self.handlers.forEach(function(handler){
                request[handler] = self[handler].bind(self);
            });
        },
        store : function(name){
            var self = this;
            var store = getStore(name, function(){ return self.db; });
            self.stores.push(store.actions);
            return store.methods;
        },
        onsuccess: function(e){
            this.db = e.target.result;
            this.stores.forEach(function(actions){
                while(actions.length){
                   actions.shift()();
                }
            })
            this.actions.forEach(function(action){
                action();
            });
            if(this.obj.onsuccess){
                this.obj.onsuccess(e);
            }
        },
        onerror: function(e){
            if(this.obj.error){
                this.obj.onsuccess(e);
            }
        },
        onupgradeneeded: function(e){
            this.db = e.target.result;
            if(this.obj.onupgradeneeded){
                this.obj.onupgradeneeded(e);
            }
        },
    };
   
   var db = {
       use : function(name){
            var obj = {};
            var db = new DataBase(name, obj);
            obj.store = db.store.bind(db);
            return obj;
       }
   };
   
   window.db = db;
   
})();


// var test = openD().succces(function(){console.log(1)})

// var init = false;
// if(!init){
// 	 var openRequest = indexedDB.open("project" ,1);
// 	    openRequest.onupgradeneeded = function(e) {
// 	        console.log("running onupgradeneeded");
// 	        var thisDB = e.target.result;
	        
// 	        if(!thisDB.objectStoreNames.contains("customers")) {
// 	            thisDB.createObjectStore("customers", { autoIncrement:true });
// 	        }
// 	    }
// }




var project = db.use('project');

project.onsuccess = function(e){
    console.log('open db success', e.target.result);
};

project.onupgradeneeded = function(){
    console.log(2);
};

project.onerror = function(){
    console.log(3);
};


project
        .store('customers')
        .add({ name: 'gasko', age : 25})
        .onsuccess = function(e){
            console.log('add item success', e.target.result); 
        };


var store = project.store('customers');

store.count().onsuccess = function(e){
    console.log('count', e.target.result); 
};
setTimeout(function (){
  store
    .add({ name: 'gasko', age : 26})
    .onsuccess = function(e){
        console.log('add item success with timeout', e.target.result); 
    }

    store.get(224).onsuccess = function(e) {
    console.log('get item success', e.target.result); 
    }      

   store.count().onsuccess = function(e){
        console.log('count', e.target.result); 
  };

    // store.clear().onsuccess = function(e){
    //     console.log('clear', e.target.result); 
    //  };

 },1000); 









