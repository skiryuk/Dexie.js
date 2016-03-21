import {derive} from './utils';

export function generatePromiseConstructor (BasePromise) {
    /* Features to support:
        V: PSD
        V: Overloaded catch() (test if needed first)
        V: finally (test if needed first)
        V: onuncatched
        _tickFinalize
        _rootExec (if needed?)
    */
    function Promise (fn) {
        if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
        this._PSD = Promise.PSD;
        if (fn instanceof BasePromise) {
            this.p = fn;
            this.up = arguments[1];
            return;
        }
        if (typeof fn !== 'function') throw new TypeError('not a function');
        this.p = new BasePromise ((resolve, reject)=>{
            let outerPSD = Promise.PSD;
            Promise.PSD = this._PSD;
            try {
                fn(resolve, error => {
                    if (this.onuncatched && !this.catched) fireUncatched(this.onuncatched, error);
                    reject(error);
                });
            } finally {
                Promise.PSD = outerPSD;
            }
        });
    }

    function fireUncatched (fn, error) {
        try {
            fn(error);
        } catch(e){};
        // Promise.on.error.fire(error);
    }


    derive(Promise).from(BasePromise).extend(()=> {
        return {
            then: function (success, fail) {
                if (fail) this._setCatched();
                return new Promise(this.p.then(success && (x => {
                    let outerPSD = Promise.PSD;
                    Promise.PSD = this._PSD;
                    try { success(x); } finally { Promise.PSD = outerPSD; }
                }), fail && (error => {
                    let outerPSD = Promise.PSD;
                    Promise.PSD = this._PSD;
                    try { fail(error); } finally { Promise.PSD = outerPSD; }
                })), this);
            },
            catch: function (onRejected) {
                if (arguments.length === 1) return this.then(null, onRejected);
                // First argument is the Error type to catch
                var type = arguments[0], callback = arguments[1];
                if (typeof type === 'function') return this.then(null, function (e) {
                    // Catching errors by its constructor type (similar to java / c++ / c#)
                    // Sample: promise.catch(TypeError, function (e) { ... });
                    if (e instanceof type) return callback(e); else return Promise.reject(e);
                });
                else return this.then(null, function (e) {
                    // Catching errors by the error.name property. Makes sense for indexedDB where error type
                    // is always DOMError but where e.name tells the actual error type.
                    // Sample: promise.catch('ConstraintError', function (e) { ... });
                    if (e && e.name === type) return callback(e); else return Promise.reject(e);
                });
            },
            finally: function(onFinally){
                return this.then(function (value) {
                    onFinally();
                    return value;
                }, function (err) {
                    onFinally();
                    return Promise.reject(err);
                });
            },
            _setCatched: function () {
                this.catched = true;
                if (this.up) this.up._setCatched();
            }
        };
    });

    Promise.PSD = null;

    Promise.resolve = function (value) {
        if (value && typeof value.then === 'function') return value;
        return new Promise(BasePromise.resolve(value));
    };

    Promise.reject = function (value) {
        return new Promise(BasePromise.reject(value));
    };

    Promise.race = function (values) {
        return new Promise(BasePromise.race(values));
    };

    Promise.all = function(values) {
        return new Promise(BasePromise.all(Array.isArray(values) ? values : Array.slice.call(arguments)));
    }
}
