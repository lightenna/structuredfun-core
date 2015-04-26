<?php

// app/config/routing.php
use Symfony\Component\Routing\RouteCollection;

$collection = new RouteCollection();
$collection->addCollection(
	// import main bundle (always there)
    $loader->import("@LightennaStructuredBundle/Resources/config/routing.yml")
);

if (file_exists(__DIR__.'/../../src/Lightenna/StructuredAddonBundle')) {
	$collection->addCollection(
		// import add on bundle only if present
	    $loader->import("@LightennaStructuredAddonBundle/Resources/config/routing.yml")
	);
}

return $collection;
