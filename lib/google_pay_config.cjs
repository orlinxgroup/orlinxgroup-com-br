function googlePayConfig(env = process.env) {
  if (env.GOOGLE_PAY_TEST_ENABLED !== 'true' || env.NODE_ENV === 'production') {
    return { enabled: false };
  }
  return { enabled: true, environment: 'TEST', merchantName: 'ORLINX GROUP' };
}
module.exports = { googlePayConfig };
