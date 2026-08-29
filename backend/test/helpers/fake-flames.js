/**
 * fake-flames.js
 * In-memory stand-in for the Mongoose FlamesResult model, used by tests that
 * exercise the persistence + attempt logic WITHOUT needing a live MongoDB.
 *
 * It implements exactly the API surface the service layer uses:
 *   findOne({ normalizedPair })
 *   findOneAndUpdate({ normalizedPair }, { $inc, $set }, { new, runValidators })
 *   create(doc)
 *
 * It also lets a test simulate a genuine duplicate-key race (creator A created
 * the record, while creator B's insert is rejected with code 11000).
 */

class FakeFlamesModel {
    constructor() {
        this.store = new Map();   // normalizedPair -> record
        this.forceCreateDuplicate = false;
        this.createCalls = 0;
        this.updateCalls = 0;
    }

    /** Seed a record directly (simulates a concurrent winner). */
    seed(record) {
        this.store.set(record.normalizedPair, { ...record });
    }

    findOne(query) {
        const key = query.normalizedPair;
        if (!this.store.has(key)) return null;
        return { ...this.store.get(key) };
    }

    findOneAndUpdate(query, update, options) {
        const key = query.normalizedPair;
        const doc = this.store.get(key);
        if (!doc) {
            return options && options.upsert ? this._upsert(query, update, options) : null;
        }

        this.updateCalls += 1;

        const next = { ...doc };
        const $inc = update.$inc || {};
        const $set = update.$set || {};

        for (const field of Object.keys($inc)) {
            next[field] = (next[field] || 0) + $inc[field];
        }
        for (const field of Object.keys($set)) {
            next[field] = $set[field];
        }

        this.store.set(key, next);
        // new:true -> return the updated doc.
        return { ...next };
    }

    _upsert(query, update, options) {
        const key = query.normalizedPair;
        const seed = query.normalizedPair ? { normalizedPair: key } : {};
        const next = { ...seed };
        const $inc = update.$inc || {};
        const $set = update.$set || {};
        for (const field of Object.keys($inc)) next[field] = $inc[field];
        for (const field of Object.keys($set)) next[field] = $set[field];
        this.store.set(key, next);
        return { ...next };
    }

    create(doc) {
        this.createCalls += 1;

        // Simulate a loser in a duplicate-key race: the winner already saved
        // this pair (attempts = 1), but our insert is rejected with 11000.
        if (this.forceCreateOnce) {
            this.forceCreateOnce = false;
            const winner = { ...doc, attempts: 1 };
            if (!this.store.has(doc.normalizedPair)) {
                this.store.set(doc.normalizedPair, winner);
            }
            const err = new Error("E11000 duplicate key error");
            err.code = 11000;
            throw err;
        }

        if (this.store.has(doc.normalizedPair)) {
            const err = new Error("E11000 duplicate key error");
            err.code = 11000;
            throw err;
        }

        this.store.set(doc.normalizedPair, { ...doc });
        return { ...doc };
    }

    findByIdAndDelete(id) {
        for (const [key, doc] of this.store.entries()) {
            if (doc._id && String(doc._id) === String(id)) {
                this.store.delete(key);
                return { ...doc };
            }
        }
        return null;
    }

    findOneAndDelete(query) {
        const key = query.normalizedPair;
        if (!this.store.has(key)) return null;
        const doc = this.store.get(key);
        this.store.delete(key);
        return { ...doc };
    }

    find() {
        const allItems = [...this.store.values()];
        return {
            sort: () => ({
                lean: async () => allItems
            })
        };
    }

    count() {
        return this.store.size;
    }

    all() {
        return [...this.store.values()];
    }
}

module.exports = { FakeFlamesModel };