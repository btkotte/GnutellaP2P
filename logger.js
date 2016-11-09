/**
 * Created by debopam on 2015-10-28.
 */
var winston = require('winston');
winston.emitErrs = true;

var logger = new winston.Logger(
    {
        transports: [
            new winston.transports.File(
                {
                    level: 'debug',//levels: debug, info, warn, error, etc.
                    name: 'application_debug',
                    filename: 'logs/debug.log',//Log file name
                    handleExceptions: true,
                    json: true,
                    maxsize: 5242880, //5MB
                    maxFiles: 10,
                    colorize: true
                }
            ),
            new (winston.transports.Console)(
                {
                    level: 'debug',
                    colorize: 'all'
                }
            )
        ],
        exitOnError: false
    }
);

module.exports = logger;