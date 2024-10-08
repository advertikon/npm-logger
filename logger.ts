import Logger from "bunyan";
import { NextFunction, Request, RequestHandler, Response } from "express";
import * as fs from "fs";
import { ulid } from "ulid";
import bytes from "bytes";

export const REQUEST_HEADER_ID = "x-req-id";
export const REQUEST_ID = "req_id";

export type LoggerRequest = Request & {
  logger: Logger;
  [REQUEST_ID]: string;
  startTime: number;
};

type Config = {
  requestCb?: (r: Request) => Record<string, string>;
  responseCb?: (req: Request, resp: Response) => Record<string, string>;
  traceMemory?: "minimal" | "verbose";
  logger?: Logger;
  version?: string;
  name?: string;
  logLevel?: "debug" | "info";
};

export const logRequest = (config?: Config): RequestHandler => {
  const mainLogger =
    config?.logger ??
    createLogger({ version: config?.version, name: config?.name });

  return function (req: LoggerRequest, resp: Response, next: NextFunction) {
    req.startTime = Date.now();
    const requestId = req.get(REQUEST_HEADER_ID) || ulid();
    const logger = mainLogger.child({
      [REQUEST_ID]: requestId,
      url: req.url,
      method: req.method,
      ...(config?.requestCb ? config.requestCb(req) : {}),
    });

    resp.on("finish", () => {
      let memoryInfo: Record<string, string> = {};

      if (
        config?.traceMemory &&
        ["minimal", "verbose"].includes(config.traceMemory)
      ) {
        memoryInfo = Object.entries(process.memoryUsage())
          .filter(([k]) =>
            config.traceMemory === "verbose" ? true : k === "rss"
          )
          .reduce((a, values) => {
            const [k, v] = values;
            a[k] = bytes(v, { thousandsSeparator: " " });
            return a;
          }, {} as Record<string, string>);
      }

      (resp.statusCode < 400
        ? (config?.logLevel === "debug" ? logger.debug : logger.info).bind(
            logger
          )
        : logger.warn.bind(logger))(
        {
          duration: Date.now() - req.startTime,
          status_code: resp.statusCode,
          ...(config?.responseCb ? config.responseCb(req, resp) : {}),
          ...memoryInfo,
        },
        "request_end"
      );
    });

    req.logger = logger;
    req[REQUEST_ID] = requestId;
    next();
  } as RequestHandler;
};

export const createLogger = (
  opt: Record<string, string | undefined> = {}
): Logger => {
  let version = opt.version;
  let name = opt.name;

  if (!version || !name) {
    const pkg = JSON.parse(fs.readFileSync("package.json").toString());
    version = version ?? pkg.version;
    name = name ?? pkg.name;
  }

  return Logger.createLogger({ name: name as string, version, ...opt });
};
