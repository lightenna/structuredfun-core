<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;

class FileviewController extends ViewController
{
	public function indexAction($rawname)
	{
		// convert rawname to urlname and filename
		$filename = self::convertRawToFilename($rawname);
		$name = self::convertRawToUrl($rawname);
		if (DEBUG && false) {
			print('name('.$filename.') type('.self::getExtension($filename).') -> '.file_exists($filename));
		}
		// catch zips
		if (self::getExtension($filename) == 'zip') {
			$dirlisting = self::getZipListing($filename);
			return $this->render('LightennaStructuredBundle:Fileview:directory.html.twig', array(
				'dirname' => $filename.'/',
				'linkpath' => $name.ZIP_SEPARATOR,
				'argsbase' => ARG_SEPARATOR.'thumb=true&',
				'argsdefault' => ARG_SEPARATOR.'thumb=true&maxwidth=200&maxheight=200',
				'dirlisting' => $dirlisting)
			);
		}
		// check if file/directory exists exactly as specified
		if (file_exists($filename)) {
			if (is_dir($filename)) {
				// process straight-forward directory
				$dirlisting = self::getDirectoryListing($filename);
				return $this->render('LightennaStructuredBundle:Fileview:directory.html.twig', array(
					'dirname' => $filename.'/',
					'linkpath' => $name.'/',
					'argsbase' => ARG_SEPARATOR.'thumb=true&',
					'argsdefault' => ARG_SEPARATOR.'thumb=true&maxwidth=200&maxheight=200',
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
