<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

use Lightenna\StructuredBundle\Entity\ImageMetadata;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;

class FileviewController extends ViewController {

  public function indexAction($rawname, $format = 'html') {
    // convert rawname to urlname and filename
    $filename = $this->convertRawToFilename($rawname);
    $name = self::convertRawToUrl($rawname);
    // create a file reader object to get directory/zip/directory-nested-in-zip listing
    $this->mfr = new CachedMetadataFileReader(null, $this);
    $this->mfr->rewrite($filename);
    $this->mfr->injectShares($name);
    $this->mfr->processDebugSettings();
    $thumbargs = new \stdClass();
    // don't need to include thumb=true in thumbargs because it's a non-key arg
    $thumbargs->{'maxlongest'} = 200;
    $this->mfr->injectArgs($thumbargs);
    if ($this->mfr->isExisting()) {
      if ($this->mfr->isDirectory()) {
        $dirlisting = $this->mfr->getListing();
        return $this
          ->render('LightennaStructuredBundle:Fileview:directory.html.twig',
            array(
              'dirname' => $name,
              'direction' => 'y',
              'celltype' => 'pc',
              'breadth' => 2,
              'linkpath' => rtrim($name, DIR_SEPARATOR) . DIR_SEPARATOR,
              'argsbase' => ARG_SEPARATOR . 'thumb=true&',
              'argsdefault' => 'maxlongest='.$thumbargs->{'maxlongest'}.'&',
              'dirlisting' => $dirlisting,
              'metaform' => $this->mfr->getMetadata()->getForm($this)->createView(),
              'defaults' => ImageMetadata::getDefaults(),
            ));
      } else {
        // prepare BinaryFileResponse
        $realname = str_replace('/','\\',$filename);
        $fileleaf = basename($filename);
        $response = new BinaryFileResponse($realname);
        $response->trustXSendfileTypeHeader();
        $response->setContentDisposition(
            ResponseHeaderBag::DISPOSITION_INLINE,
            $fileleaf,
            iconv('UTF-8', 'ASCII//TRANSLIT', $fileleaf)
        );
        return $response;
      }
    } else {
      // implied else
      return $this->render('LightennaStructuredBundle:Fileview:file_not_found.html.twig');
    }
  }

}
