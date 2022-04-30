import Logger, { LoggerOptions } from 'bunyan';
import { Request, Response, NextFunction } from 'express';
import { ulid } from 'ulid';

export const logRequest = (req: Request, resp: Response, next: NextFunction) => {
    createLogger({
        name: process.env.npm_package_name as string,
        request: req,
        serializers: {
            req: (req) => {
                const ret =  {
                    method: req.method,
                    url: req.url,
                };

                if (req.headers['x-orig-req']) {
                    // @ts-ignore
                    ret.orig_request = req.headers['x-orig-req'];
                }

                return ret;
            }
        }
    });

    // @ts-ignore
    req.logger.info({ req });

    next();
};

export const createLogger = (opt: LoggerOptions & {request: Request}): Logger => {
    const { request, ...options } = opt;
    const logger = Logger.createLogger(options);

    if (request) {
        const id = ulid();
        // @ts-ignore
        request.logger = logger.child({ req_id: id });
        // @ts-ignore
        request.req_id = id;
    }

    return logger;
};


