import express from 'express';
import { loadConfig } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { requestContext } from './middleware/request-context.js';
import { requestLogger } from './middleware/request-logger.js';
import { validateJsonBody } from './middleware/validate-json-body.js';
import { cors } from './middleware/cors.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createLogger } from './utils/logger.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createAuthService } from './services/auth.service.js';
import { User } from './models/user.model.js';
import { createApplicationRouter } from './routes/application.routes.js';
import { createApplicationService } from './services/application.service.js';
import { createMockCreditScoreProvider } from './services/credit-score.provider.js';
import { createEligibilityService } from './services/eligibility.service.js';
import { createApprovalRouter } from './routes/approval.routes.js';
import { createApprovalService } from './services/approval.service.js';
import { createDispatchRouter } from './routes/dispatch.routes.js';
import { createDispatchService } from './services/dispatch.service.js';
import { createReportingRouter } from './routes/reporting.routes.js';
import { createReportingService } from './services/reporting.service.js';
import { createRateLimiter, createSecurityHeaders, defaultRateLimits } from './middleware/security.js';

export function createApp({
  config = loadConfig(),
  logger = createLogger(),
  authService,
  userModel = User,
  applicationService,
  creditScoreProvider = createMockCreditScoreProvider(),
  approvalService,
  dispatchService,
  reportingService,
  rateLimits = {},
} = {}) {
  const limits = {
    api: { ...defaultRateLimits.api, ...rateLimits.api },
    auth: { ...defaultRateLimits.auth, ...rateLimits.auth },
    loginFailures: { ...defaultRateLimits.loginFailures, ...rateLimits.loginFailures },
  };
  const app = express();
  const configuredAuthService = authService ?? createAuthService({ userModel });
  const configuredEligibilityService = createEligibilityService({
    creditScoreProvider,
    creditLimit300kTo500k: config.creditLimit300kTo500k,
  });
  const configuredApplicationService = applicationService ?? createApplicationService({
    eligibilityService: configuredEligibilityService,
  });
  const configuredApprovalService = approvalService ?? createApprovalService({
    creditLimitRequiresConfirmation: config.creditLimit300kTo500kRequiresConfirmation,
  });
  const configuredDispatchService = dispatchService ?? createDispatchService();
  const configuredReportingService = reportingService ?? createReportingService();

  app.disable('x-powered-by');
  if (config.trustProxy !== undefined && config.trustProxy !== false) {
    app.set('trust proxy', config.trustProxy);
  }
  app.use(requestContext);
  app.use(createSecurityHeaders({ enableHsts: config.nodeEnv === 'production' }));
  app.use(requestLogger(logger));
  app.use(cors(config.allowedOrigins));
  // Health checks are mounted before the general limiter so load-balancer
  // probes never get throttled.
  app.use('/api', createHealthRouter());
  app.use('/api', createRateLimiter(limits.api));
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', validateJsonBody);
  app.use('/api/auth', createRateLimiter(limits.auth), createAuthRouter({
    config,
    authService: configuredAuthService,
    userModel,
    loginLimiter: createRateLimiter({
      ...limits.loginFailures,
      skipSuccessfulRequests: true,
      message: 'Too many failed sign-in attempts. Please try again later.',
    }),
  }));
  app.use('/api/applications', createApplicationRouter({
    config,
    applicationService: configuredApplicationService,
    userModel,
  }));
  app.use('/api/approvals', createApprovalRouter({
    config,
    approvalService: configuredApprovalService,
    userModel,
  }));
  app.use('/api/card-dispatch', createDispatchRouter({
    config,
    dispatchService: configuredDispatchService,
    userModel,
  }));
  app.use('/api/reports', createReportingRouter({
    config,
    reportingService: configuredReportingService,
    userModel,
  }));
  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
