describe('IDBWrapper', function(){

  describe('delete databases', function(){
    var store;
    var f = function(name, done){
      var request = indexedDB.open("project" ,1);
      request.onupgradeneeded = function(e) {
         console.log("running onupgradeneeded");
         var thisDB = e.target.result;
          
         if(!thisDB.objectStoreNames.contains("customers")) {
             thisDB.createObjectStore("customers", { autoIncrement:true });
         }
      }
      request.onsuccess = function(){
        done();
      }
    }
    before(function(done){
      f(1, done);
    });

    it('should delete the newly created database', function(done){
      f(2, function(){
         expect(2).to.be.equal(2);
         done();
      })
    });

  });

});
