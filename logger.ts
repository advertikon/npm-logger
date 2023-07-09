import Logger from 'bunyan';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import * as fs from 'fs';
import { ulid } from 'ulid';

export const REQUEST_HEADER_ID = 'x-req-id';
export const REQUEST_ID = 'req_id'

export type LoggerRequest = Request & {
    logger: Logger;
    [REQUEST_ID]: string;
    startTime: number;
}

type Config = {
    requestCb?: (r: Request) => Record<string, string>;
    responseCb?: (r: Response) => Record<string, string>;
}

export const logRequest = (config?: Config): RequestHandler => {
    const mainLogger = createLogger();

    return function (req: LoggerRequest, resp: Response, next: NextFunction) {
        req.startTime = Date.now();
        const requestId = req.get(REQUEST_HEADER_ID) || ulid();
        const logger = mainLogger.child({
            [REQUEST_ID]: requestId,
            url: req.url,
            method: req.method,
            ...(config?.requestCb ? config.requestCb(req) : {})
        });

        resp.on('finish', () => {
            logger.info({
                time: Date.now() - req.startTime,
                status_code: resp.statusCode,
                ...(config?.responseCb ? config.responseCb(resp) : {})
            }, 'request_end');
        });

        req.logger = logger;
        req[REQUEST_ID] = requestId;
        next();
    } as RequestHandler
}

export const createLogger = (opt: Record<string, string> = {}): Logger => {
    const pkg = JSON.parse(fs.readFileSync('package.json').toString());
    const { name, version } = pkg;
    return Logger.createLogger({ name, version, ...opt });
};


