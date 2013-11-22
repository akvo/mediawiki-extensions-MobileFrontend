/* Defines all possible routes in MobileFrontend and where to find the code to provide them. */
( function( M, $ ) {
	var lastFile;
	// FIXME: this is hacky but it would be hard to pass a file in a route
	M.on( '_upload-preview', function( file ) {
		lastFile = file;
	} );

	// Upload Tutorial
	M.overlayManager.add( /^\/upload-tutorial\/?(.*)$/, function( funnel ) {
		var result = $.Deferred();
		// FIXME: Use loadModuleScript function in notifications.js so that this shows a loader
		// or make showing a loader part of OverlayManager
		mw.loader.using( 'mobile.uploadsNew', function() {
			var UploadTutorialNew = M.require( 'modules/uploads/UploadTutorial' );
			result.resolve( new UploadTutorialNew( { funnel: funnel || null } ) );
		} );
		return result;
	} );

	// Upload Preview
	M.overlayManager.add( /^\/upload-preview\/?(.*)$/, function( funnel ) {
		var result = $.Deferred();
		// FIXME: Use loadModuleScript function in notifications.js so that this shows a loader
		// or make showing a loader part of OverlayManager
		mw.loader.using( 'mobile.uploadsNew', function() {
			var PhotoUploadOverlay = M.require( 'modules/uploadsNew/PhotoUploadOverlay' );
			result.resolve( new PhotoUploadOverlay( {
				pageTitle: mw.config.get( 'wgTitle' ),
				file: lastFile,
				funnel: funnel,
				// When the funnel is uploads you are on Special:Uploads
				insertInPage: funnel === 'uploads' ? false : true
			} ) );
		} );
		return result;
	} );

} )( mw.mobileFrontend, jQuery );
