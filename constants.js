/**
 * Created by debopam on 2015-10-25.
 */
/**
 * Default listening port
 */
const LISTEN_PORT = 7000;

/**
 * IP address of this node in dot-decimal notation
 */
const MY_IP = '192.168.0.5';

/**
 * IP address of this node in HEX
 */
const MY_IP_HEX = 'c0a80005';

/**
 * Published key-value pair for this node
 */
const PUB_KEY = 'key67890';
const PUB_VAL = '12121212';

/**
 * Bootstrap peer list
 */
//const BOOTSTRAP_IP1 = '130.233.195.30';
const BOOTSTRAP_IP1 = '192.168.0.5';
const BOOTSTRAP_IP2 = '130.233.195.31';
const BOOTSTRAP_IP3 = '130.233.195.32';
const BOOTSTRAP_PORT = 6346;

/**
 * Various search keys to be searched
 */
const SEARCH_KEY1 = 'commonkey';
const SEARCH_KEY2 = 'key12345';
const SEARCH_KEY3 = 'vm2testkey';
const SEARCH_KEY4 = 'vm3testkey';

/**=================================================
 * PROTOCOL HEADER SPECIFIC CONSTANTS BELOW
 * =================================================
 */
/**
 * Ping message type
 */
const MSG_PING = '00';

/**
 * Pong message type
 */
const MSG_PONG = '01';

/**
 * Bye message type
 */
const MSG_BYE = '02';

/**
 * Join message type
 */
const MSG_JOIN = '03';

/**
 * Query request message type
 */
const MSG_QUERY = '80';

/**
 * Query hit message type
 */
const MSG_QHIT = '81';

/**
 * Protocol version
 */
const P_VERSION = '01';

/**
 * MAX TTL
 */
const MAX_TTL = '05';
/**
 * MIN TTL
 */
const MIN_TTL = '01';
/**
 * max number of entries for a PONG response
 */
const MAX_PEER_AD = '05';

/**
 * TTL value for PING (heart beat)
 */
const PING_TTL_HB = '01';

/**
 * Reply code of JOIN accept
 */
const JOIN_ACC = '0200';

/**
 * Used to set RESERVED byte, set to all zeros
 */
const RESERVED = '00';

/**
 * Length when no payload
 */
const NO_PAYLOAD_LEN = '0000';

module.exports = {
    LISTEN_PORT: LISTEN_PORT,
    MY_IP: MY_IP,
    MY_IP_HEX: MY_IP_HEX,
    MSG_PING: MSG_PING,
    MSG_PONG: MSG_PONG,
    MSG_BYE: MSG_BYE,
    MSG_JOIN: MSG_JOIN,
    MSG_QUERY: MSG_QUERY,
    MSG_QHIT: MSG_QHIT,
    P_VERSION: P_VERSION,
    MAX_TTL: MAX_TTL,
    MIN_TTL: MIN_TTL,
    MAX_PEER_AD: MAX_PEER_AD,
    PING_TTL_HB: PING_TTL_HB,
    JOIN_ACC: JOIN_ACC,
    RESERVED: RESERVED,
    NO_PAYLOAD_LEN: NO_PAYLOAD_LEN,
    PUB_KEY: PUB_KEY,
    PUB_VAL: PUB_VAL,
    BOOTSTRAP_IP1: BOOTSTRAP_IP1,
    BOOTSTRAP_IP2: BOOTSTRAP_IP2,
    BOOTSTRAP_IP3: BOOTSTRAP_IP3,
    BOOTSTRAP_PORT: BOOTSTRAP_PORT,
    SEARCH_KEY1: SEARCH_KEY1,
    SEARCH_KEY2: SEARCH_KEY2,
    SEARCH_KEY3: SEARCH_KEY3,
    SEARCH_KEY4: SEARCH_KEY4

};
