var crypto = require('crypto'),
    request = require('request'),
    moment = require('moment');

/*
 * Format requests for Atmos
 */
function AtmosRequest ( method, resource, conf, body ) {

  if ( !method || !resource || !conf )
      throw new Error('AtmosRequest: should be passed method, resource, and configuration');

  if ( !conf.url || !conf.uid || !conf.secret )
      throw new Error('AtmosRequest: configuration object must contain url, uid, and secret');

  this._method = method,
  this._baseUrl = conf.url,
  this._secret = conf.secret;
  this._uid = conf.uid;
  this._resource = resource,
  this._time = moment.utc().format('ddd, D MMM YYYY HH:mm:ss') + ' UTC',
  this._headers = {};

  this.setHeader('x-emc-date', this._time)
      .setHeader('date', this._time)
      .setHeader('accept', '*/*')
      .setHeader('x-emc-uid', this._uid)

  if (body) {
    var hash = crypto.createHash('md5');
    hash.update(body);

    this.setHeader('content-length', body.length);
    this.setHeader('content-md5', hash.digest('binary'));
    this.setBody(body);
  }
  
  this.sign();
}

AtmosRequest.prototype.setHeader = function ( key, value ) {
  if (typeof this._headers['x-emc-signature'] !== 'undefined')
    throw new Error('AtmosRequest: All headers must be set before signing');

  this._headers[key] = value;
  return this;
}

AtmosRequest.prototype.setBody = function ( body ) {
  this._body = body;
}

AtmosRequest.prototype.sign = function () {
  if (typeof this._headers['x-emc-uid'] === 'undefined')
    throw new Error('AtmosRequest: All headers must be set before signing');

  var key = new Buffer(this._secret, 'base64').toString('binary'),
      hash = crypto.createHmac('sha1', key);
      hash.update( this._method );
      hash.update( "\n\n\n" );
      hash.update( this._time );
      hash.update( "\n" );
      hash.update( this._resource.toLowerCase() );
      hash.update( "\n" );
      hash.update( "x-emc-date:" + this._headers['x-emc-date'] );
      hash.update( "\n" );
      hash.update( "x-emc-uid:" + this._headers['x-emc-uid'] );

  this._headers['x-emc-signature'] = hash.digest('base64');
}

AtmosRequest.prototype.send = function ( cb ) {
  if (typeof this._headers['x-emc-signature'] === 'undefined')
    cb(new Error('AtmosRequest: Requests must be signed prior to sending'));

  request({
    timeout: 20000,
    url: this._baseUrl + this._resource,
    method: this._method,
    body: this._body,
    headers: this._headers
  }, cb)
}

module.exports = AtmosRequest;