<?php

namespace Lightenna\StructuredBundle\Controller;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;

class FileviewController extends ViewController {

  public function indexAction($rawname, $format = 'html') {
    // convert rawname to urlname and filename
    $filename = $this->convertRawToFilename($rawname);
    $name = self::convertRawToUrl($rawname);
    if (DEBUG && false) {
      print('name(' . $filename . ') type(' . self::getExtension($filename) . ') -> ' . file_exists($filename));
    }
    // create a file reader object to get directory/zip/directory-nested-in-zip listing
    $fr = new MetadataFileReader($filename);
    if ($fr->isExisting) {
      if ($fr->isDirectory) {
        $dirlisting = $fr->getListing();
        return $this
          ->render('LightennaStructuredBundle:Fileview:directory.html.twig',
            array(
              'dirname' => $name,
              'direction' => 'x',
              'celltype' => 'em',
              'linkpath' => rtrim($name, DIR_SEPARATOR) . DIR_SEPARATOR,
              'argsbase' => ARG_SEPARATOR . 'thumb=true&',
              'argsdefault' => 'maxlongest=200&',
              'dirlisting' => $dirlisting
            ));
      } else {
        // process file
        return $this->render('LightennaStructuredBundle:Fileview:file.html.twig', array(
            'filename' => $filename,
        ));
      }
    } else {
      // implied else
      return $this->render('LightennaStructuredBundle:Fileview:file_not_found.html.twig');
    }
  }

}
