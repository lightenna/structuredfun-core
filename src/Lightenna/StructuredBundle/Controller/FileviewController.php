<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;

class FileviewController extends ViewController
{
	public function indexAction($name)
	{
		// convert urlname to fs filename
		$filename = self::convertUrlToFilename($name);
		if (DEBUG && false) {
			print('name('.$filename.') type('.self::getExtension($filename).') -> '.file_exists($filename));
		}
		// catch zips
		if (self::getExtension($filename) == 'zip') {
			$dirlisting = self::getZipListing(rtrim($filename,'/'));
			return $this->render('LightennaStructuredBundle:Fileview:directory.html.twig', array(
				'dirname' => rtrim($filename,'/'),
				'linkpath' => rtrim($name,'/').ZIP_SEPARATOR,
				'dirlisting' => $dirlisting)
			);
		}
		// check if file/directory exists exactly as specified
		if (file_exists($filename)) {
			if (is_dir($filename)) {
				// process straight-forward directory
				$dirlisting = self::getDirectoryListing($filename);
				return $this->render('LightennaStructuredBundle:Fileview:directory.html.twig', array(
					'dirname' => $filename,
					'linkpath' => $name,
					'dirlisting' => $dirlisting)
				);
			} else {
				// process file
				return $this->render('LightennaStructuredBundle:Fileview:file.html.twig', array(
					'filename' => $filename,
				));
			}
		}
		// implied else
		return $this->render('LightennaStructuredBundle:Fileview:file_not_found.html.twig');
	}

}
