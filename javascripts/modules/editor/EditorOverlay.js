( function( M, $ ) {

	var Overlay = M.require( 'Overlay' ),
		user = M.require( 'user' ),
		Page = M.require( 'Page' ),
		schema = M.require( 'loggingSchemas/mobileWebEditing' ),
		popup = M.require( 'toast' ),
		inBetaOrAlpha = M.isBetaGroupMember(),
		inCampaign = M.query.campaign ? true : false,
		inKeepGoingCampaign = M.query.campaign === 'mobile-keepgoing',
		Section = M.require( 'Section' ),
		EditorApi = M.require( 'modules/editor/EditorApi' ),
		KeepGoingDrawer,
		AbuseFilterOverlay = M.require( 'modules/editor/AbuseFilterOverlay' ),
		EditorOverlay;

	EditorOverlay = Overlay.extend( {
		defaults: {
			continueMsg: mw.msg( 'mobile-frontend-editor-continue' ),
			saveMsg: mw.msg( 'mobile-frontend-editor-save' ),
			cancelMsg: mw.msg( 'mobile-frontend-editor-cancel' ),
			keepEditingMsg: mw.msg( 'mobile-frontend-editor-keep-editing' ),
			summaryMsg: mw.msg( 'mobile-frontend-editor-summary-placeholder' ),
			licenseMsg: mw.msg( 'mobile-frontend-editor-license' ),
			placeholder: mw.msg( 'mobile-frontend-editor-placeholder' ),
			previewMsg: mw.msg( 'mobile-frontend-editor-preview-header' ),
			waitMsg: mw.msg( 'mobile-frontend-editor-wait' ),
			guiderMsg: mw.msg( 'mobile-frontend-editor-guider' ),
			captchaMsg: mw.msg( 'mobile-frontend-account-create-captcha-placeholder' ),
			captchaTryAgainMsg: mw.msg( 'mobile-frontend-editor-captcha-try-again' ),
			abusefilterReadMoreMsg: mw.msg( 'mobile-frontend-editor-abusefilter-read-more')
		},
		// FIXME: [QA] Needs an acceptance test to ensure we do not break the first time editor workflow
		templatePartials: {
			content: M.template.get( 'modules/editor/EditorOverlay' )
		},
		className: 'mw-mf-overlay editor-overlay',

		log: function( action, errorText ) {
			var data = { action: action, section: this.sectionId, funnel: this.funnel };
			if ( errorText ) {
				data.errorText = errorText;
			}
			schema.log( data );
		},

		initialize: function( options ) {
			this.api = new EditorApi( {
				title: options.title,
				sectionId: options.sectionId,
				isNew: options.isNew
			} );
			this.sectionId = options.sectionId;
			this.isNewEditor = options.isNewEditor;
			this.editCount = user.getEditCount();
			this.isFirstEdit = this.editCount === 0;
			this.funnel = options.funnel;
			this._super( options );
		},

		postRender: function( options ) {
			var self = this;
			this._super( options );

			this.$spinner = this.$( '.spinner' );
			this.$preview = this.$( '.preview' );
			this.$content = this.$( 'textarea' ).
				on( 'input', function() {
					self.api.setContent( self.$content.val() );
					self.$( '.continue, .save' ).prop( 'disabled', false );
				} );
			this.$( '.continue' ).on( 'click', $.proxy( this, '_showPreview' ) );
			this.$( '.back' ).on( 'click', $.proxy( this, '_hidePreview' ) );
			this.$( '.save' ).on( 'click', $.proxy( this, '_save' ) );
			this.$( '.cancel' ).on( 'click', function() {
				// log cancel attempt
				self.log( 'cancel' );
			} );
			// make license links open in separate tabs
			this.$( '.license a' ).attr( 'target', '_blank' );

			// This is used to avoid position: fixed weirdness in mobile Safari when
			// the keyboard is visible
			if ( ( /ipad|iphone/i ).test( navigator.userAgent ) ) {
				this.$content.
					on( 'focus', function() {
						self.$( '.buttonBar' ).removeClass( 'position-fixed' );
					} ).
					on( 'blur', function() {
						self.$( '.buttonBar' ).addClass( 'position-fixed' );
					} );
			}

			this._loadContent();
			// log section edit attempt
			self.log( 'attempt' );
		},

		hide: function() {
			var confirmMessage = mw.msg( 'mobile-frontend-editor-cancel-confirm' );
			if ( !this.api.hasChanged || this.canHide || window.confirm( confirmMessage ) ) {
				return this._super();
			} else {
				return false;
			}
		},

		_showPreview: function() {
			var self = this, params = { text: this.$content.val() };

			// log save button click
			this.log( 'save' );
			this._showBar( '.save-bar' );

			this.scrollTop = $( 'body' ).scrollTop();
			this.$content.hide();
			this.$spinner.show();

			// pre-fetch keep going with expectation user will go on to save
			if ( inBetaOrAlpha && ( ( this.isFirstEdit && !inCampaign ) || inKeepGoingCampaign ) ) {
				mw.loader.using( 'mobile.keepgoing', function() {
					KeepGoingDrawer = M.require( 'modules/keepgoing/KeepGoingDrawer' );
				} );
			}

			if ( mw.config.get( 'wgIsMainPage' ) ) {
				params.mainpage = 1; // Setting it to 0 will have the same effect
			}
			this.api.getPreview( params ).done( function( parsedText ) {
				new Section( {
					el: self.$preview.find( '.content' ),
					content: parsedText
				// bug 49218: stop links from being clickable (note user can still hold down to navigate to them)
				} ).$( 'a' ).on( 'click', false );
				// Emit event so we can perform enhancements to page
				M.emit( 'edit-preview', self );
			} ).fail( function() {
				self.$preview.addClass( 'error' ).find( '.content' ).text( mw.msg( 'mobile-frontend-editor-error-preview' ) );
			} ).always( function() {
				self.$spinner.hide();
				self.$preview.show();
			} );
		},

		_hidePreview: function() {
			this.api.abort();
			this.$spinner.hide();
			this.$preview.removeClass( 'error' ).hide();
			this.$content.show();
			window.scrollTo( 0, this.scrollTop );
			this._showBar( '.initial-bar' );
		},

		_loadContent: function() {
			var self = this;

			this.$content.hide();
			this.$spinner.show();

			this.api.getContent().
				done( function( content ) {
					self.$content.
						show().
						val( content ).
						microAutosize();
					self.$spinner.hide();
				} ).
				fail( function( error ) {
					popup.show( mw.msg( 'mobile-frontend-editor-error-loading' ), 'toast error' );
					// log error that occurred in retrieving section
					self.log( 'error', error );
				} );
		},

		_showCaptcha: function( url ) {
			var self = this, $input = this.$( '.captcha-word' );

			if ( this.captchaShown ) {
				$input.val( '' );
				$input.attr( 'placeholder', this.options.captchaTryAgainMsg );
				setTimeout( function() {
					$input.attr( 'placeholder', self.options.captchaMsg );
				}, 2000 );
			}

			this.$( '.captcha-bar img' ).attr( 'src', url );
			this._showBar( '.captcha-bar' );

			this.captchaShown = true;
		},

		_updateEditCount: function() {
			this.isFirstEdit = false;
			this.editCount += 1;
			mw.config.set( 'wgUserEditCount', this.editCount );
		},

		_showAbuseFilter: function( type, message ) {
			var self = this, msg;

			this.$( '.abusefilter-bar .readmore' ).on( 'click', function() {
				self.canHide = true;
				new AbuseFilterOverlay( { parent: self, message: message } ).show();
				self.canHide = false;
			} );

			if ( type === 'warning' ) {
				msg = mw.msg( 'mobile-frontend-editor-abusefilter-warning' );
			} else if ( type === 'disallow' ) {
				msg = mw.msg( 'mobile-frontend-editor-abusefilter-disallow' );
				// disable continue and save buttons, reenabled when user changes content
				this.$( '.continue, .save' ).prop( 'disabled', true );
			}

			this.$( '.message p' ).text( msg );
			this._showBar( '.abusefilter-bar' );
		},

		_save: function() {
			var self = this, className = 'toast landmark',
				options = { summary: this.$( '.summary' ).val() },
				msg;

			if ( this.captchaId ) {
				options.captchaId = this.captchaId;
				options.captchaWord = this.$( '.captcha-word' ).val();
			}

			self.log( 'submit' );
			this._showBar( '.saving-bar' );

			this.api.save( options ).
				done( function() {
					var title = self.options.title;

					// log success!
					self.log( 'success' );
					M.pageApi.invalidatePage( title );
					new Page( { title: title, el: $( '#content_wrapper' ) } ).on( 'ready', M.reloadPage );
					M.router.navigate( '' );
					self.hide();
					if ( self.isNewEditor ) {
						msg = 'mobile-frontend-editor-success-landmark-1';
					} else {
						className = 'toast';
						msg = 'mobile-frontend-editor-success';
					}
					self._updateEditCount();
					// Set a cookie for 30 days indicating that this user has edited from
					// the mobile interface.
					$.cookie( 'mobileEditor', 'true', { expires: 30 } );
					// double check it was successfully pre-fetched during preview phase
					if ( KeepGoingDrawer ) {
						new KeepGoingDrawer( { isFirstEdit: self.isFirstEdit } );
					} else {
						// just show a toast
						popup.show( mw.msg( msg ), className );
					}
				} ).
				fail( function( data ) {
					var msg;

					if ( data.type === 'captcha' ) {
						self.captchaId = data.details.id;
						self._showCaptcha( data.details.url );
					} else if ( data.type === 'abusefilter' ) {
						self._showAbuseFilter( data.details.type, data.details.message );
					} else {
						if ( data.details === 'editconflict' ) {
							msg = mw.msg( 'mobile-frontend-editor-error-conflict' );
						} else {
							msg = mw.msg( 'mobile-frontend-editor-error' );
						}

						popup.show( msg, 'toast error' );
						self._showBar( '.save-bar' );
						// log error that occurred in retrieving section
						self.log( 'error', data.details );
					}
				} );
		},

		_showBar: function( className ) {
			this.$( '.buttonBar' ).hide();
			this.$( className ).show();
		}
	} );

	M.define( 'modules/editor/EditorOverlay', EditorOverlay );

}( mw.mobileFrontend, jQuery ) );
