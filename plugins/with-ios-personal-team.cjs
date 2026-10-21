const { withEntitlementsPlist } = require('expo/config-plugins');

// Free Apple accounts cannot sign the APNs entitlement. Keep the notifications
// module for local reminders; only opt-in development builds use this plugin.
module.exports = function withIosPersonalTeam(config) {
  return withEntitlementsPlist(config, (modConfig) => {
    delete modConfig.modResults['aps-environment'];
    return modConfig;
  });
};
