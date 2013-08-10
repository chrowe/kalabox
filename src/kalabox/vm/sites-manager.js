/**
 * Manages sites on the Kalabox virtual machine.
 *
 * Copyright 2013 Kalamuna LLC
 */

// Dependencies:
var flow = require('nue').flow,
    as = require('nue').as,
    exec = require('child_process').exec,
    http = require('http'),
    host = require('../utils/host'),
    config = require('../../config');

// "Constants":
var SITES_SOURCE = 'http://aliases.kala',
    KALASTACK_DIR = config.get('KALASTACK_DIR');

/**
 * Gets the list of sites, both running and available to build.
 *
 * @param function callback
 *   Callback to call with error, if one occurs, and object containing 'builtSites' and 'unbuiltSites'
 */
exports.getSitesList = flow('getSitesList')(
  function getSitesList0(callback) {
    this.data.callback = callback;
    // Get sites list from the VM.
    var that = this;
    http.get(SITES_SOURCE, this.async(as(0))).on('error', function(error) {
      that.endWith(error);
    });
  },
  function getSitesList1(response) {
    var that = this;
    that.data.data = '';
    response.on('data', function(chunk) {
      that.data.data += chunk;
    }).on('end', this.async(as(0)));
  },
  function getSitesListEnd(end) {
    if (this.err) {
      this.data.callback(this.err);
      this.err = null;
    }
    else {
      this.data.callback(null, JSON.parse(this.data.data));
    }
    this.next();
  }
);

/**
 * Builds a site on the virtual machine.
 *
 * @param object options
 *   Site parameters with site (required), siteName, profile, and files.
 * @param function callback
 *   Function to call with error if one occurs.
 */
exports.buildSite = flow('buildSite')(
  function buildSite0(options, callback) {
    this.data.callback = callback;
    this.data.options = options;
    // Build command from site options.
    var command = 'drush build ';
    command += options.site;
    if (options.siteName) {
      command += ' --site-name="' + options.siteName + '"';
    }
    if (options.profile) {
      command += ' --profile="' + options.profile + '"';
    }
    if (options.files) {
      command += ' --files';
    }
    // Run command against VM via Vagrant.
    exec('vagrant ssh -c \'' + command + '\'', {cwd: KALASTACK_DIR}, this.async());
  },
  function buildSite1(stdout, stderr) {
    // Add site entry to /etc/hosts.
    var siteId = this.data.options.site.split('.');
    siteId = siteId[0];
    host.addHostsEntry(siteId + ".kala", this.async());
  },
  function buildSiteEnd() {
    if (this.err) {
      this.data.callback(this.err);
      this.err = null;
    }
    else {
      this.data.callback();
    }
    this.next();
  }
);

/**
 * Removes a site from the virtual machine.
 *
 * @param object site
 *   Site object with aliasName (required) and builtFrom (for remote sites).
 * @param function callback
 *   Function to call with error if one occurs.
 */
exports.removeSite = flow('removeSite')(
  function removeSite0(site, callback) {
    this.data.callback = callback;
    this.data.site = site.uri;
    // Run command against VM via Vagrant.
    var alias = site.aliasName;
    if (site.builtFrom) {
      alias = site.builtFrom;
    }
    exec('vagrant ssh -c \'drush crush ' + alias + '\'', {cwd: KALASTACK_DIR}, this.async());
  },
  function removeSite1(stdout, stderr) {
    // Remove entry from /etc/hosts.
    host.removeHostsEntry(this.data.site, this.async());
  },
  function removeSiteEnd() {
    if (this.err) {
      this.data.callback(this.err);
      this.err = null;
    }
    else {
      this.data.callback();
    }
    this.next();
  }
);
