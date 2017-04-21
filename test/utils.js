const assert = require('chai').assert;

module.exports = {
    fail(message) {
        throw new Error(message);
    },
    assertVmException(error) {
        assert.include(error.message, 'invalid JUMP');
    }
};
