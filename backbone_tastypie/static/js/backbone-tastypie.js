/**
 * Backbone-tastypie.js 0.2.0
 * (c) 2011 Paul Uithol
 *
 * Backbone-tastypie may be freely distributed under the MIT license.
 * Add or override Backbone.js functionality, for compatibility with django-tastypie.
 * Depends on Backbone (and thus on Underscore as well): https://github.com/documentcloud/backbone.
 */
( function( root, factory ) {
	// Set up Backbone-relational for the environment. Start with AMD.
	if ( typeof define === 'function' && define.amd ) {
		define( [ 'exports', 'backbone', 'underscore' ], factory );
	}
	// Next for Node.js or CommonJS.
	else if ( typeof exports !== 'undefined' ) {
		factory( exports, require( 'backbone' ), require( 'underscore' ) );
	}
	// Finally, as a browser global. Use `root` here as it references `window`.
	else {
		factory( root, root.Backbone, root._ );
	}
}( this, function( exports, Backbone, _ ) {
	"use strict";

	Backbone.Tastypie = {
		apiKey: {
			username: '',
			key: ''
		},
		constructSetUrl: function( ids ) {
			return 'set/' + ids.join( ';' ) + '/';
		},
		csrfToken: '',
		defaultOptions: {},
		doGetOnEmptyPostResponse: true,
		doGetOnEmptyPutResponse: false,
		idAttribute: 'id'
	};

	Backbone.Model.prototype.idAttribute = Backbone.Tastypie.idAttribute;

	/**
	 * Override Backbone's sync function, to do a GET upon receiving a HTTP CREATED.
	 * This requires 2 requests to do a create, so you may want to use some other method in production.
	 * Modified from http://joshbohde.com/blog/backbonejs-and-django
	 */
	Backbone.oldSync = Backbone.sync;
	Backbone.sync = function( method, model, options ) {
		var headers = {},
			options = _.defaults( options || {}, Backbone.Tastypie.defaultOptions );

		if ( Backbone.Tastypie.apiKey && Backbone.Tastypie.apiKey.username ) {
			headers[ 'Authorization' ] = 'ApiKey ' + Backbone.Tastypie.apiKey.username + ':' + Backbone.Tastypie.apiKey.key;
		}

		if ( Backbone.Tastypie.csrfToken ) {
			headers[ 'X-CSRFToken' ] = Backbone.Tastypie.csrfToken;
		}

		// Keep `headers` for a potential second request
		headers = _.extend( headers, options.headers );
		options.headers = headers;

		if ( ( method === 'create' && Backbone.Tastypie.doGetOnEmptyPostResponse ) ||
			( method === 'update' && Backbone.Tastypie.doGetOnEmptyPutResponse ) ) {
			var dfd = new $.Deferred();

			// Set up 'success' handling
			var success = options.success;
			dfd.done( function( resp, textStatus, xhr ) {
				_.isFunction( success ) && success( resp );
			});

			options.success = function( resp, textStatus, xhr ) {
				// If create is successful but doesn't return a response, fire an extra GET.
				// Otherwise, resolve the deferred (which triggers the original 'success' callbacks).
				if ( !resp && ( xhr.status === 201 || xhr.status === 202 || xhr.status === 204 ) ) { // 201 CREATED, 202 ACCEPTED or 204 NO CONTENT; response null or empty.
					options = _.defaults( {
							url: xhr.getResponseHeader( 'Location' ) || model.url(),
							headers: headers,
							success: dfd.resolve,
							error: dfd.reject
						},
						Backbone.Tastypie.defaultOptions
					);
					return Backbone.ajax( options );
				}
				else {
					return dfd.resolveWith( options.context || options, [ resp, textStatus, xhr ] );
				}
			};

			// Set up 'error' handling
			var error = options.error;
			dfd.fail( function( xhr, textStatus, errorThrown ) {
				_.isFunction( error ) && error( xhr.responseText );
			});

			options.error = function( xhr, textStatus, errorText ) {
				dfd.rejectWith( options.context || options, [ xhr, textStatus, xhr.responseText ] );
			};

			// Create the request, and make it accessibly by assigning it to the 'request' property on the deferred
			dfd.request = Backbone.oldSync( method, model, options );
			return dfd;
		}

		return Backbone.oldSync( method, model, options );
	};

	/**
	 * Return the first entry in 'data.objects' if it exists and is an array, or else just plain 'data'.
	 *
	 * @param {object} data
	 */
	Backbone.Model.prototype.parse = function( data ) {
		return data && data.objects && ( _.isArray( data.objects ) ? data.objects[ 0 ] : data.objects ) || data;
	};

	/**
	 * Return 'data.objects' if it exists.
	 * If present, the 'data.meta' object is assigned to the 'collection.meta' var.
	 *
	 * @param {object} data
	 */
	Backbone.Collection.prototype.parse = function( data ) {
		if ( data && data.meta ) {
			this.meta = data.meta;
		}

		return data && data.objects || data;
	};
}));
