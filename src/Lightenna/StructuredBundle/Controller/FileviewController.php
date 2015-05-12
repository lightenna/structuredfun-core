<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

use Lightenna\StructuredBundle\Entity\ImageMetadata;
use Lightenna\StructuredBundle\DependencyInjection\LayerOuter;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;

class FileviewController extends ViewController {

  public function indexAction($rawname, $format = 'html') {
    // store rawname being indexed
    $this->rawname = $rawname;
    // convert rawname to urlname and filename
    $filename = $this->convertRawToFilename($this->rawname);
    $name = self::convertRawToUrl($this->rawname);
    // create a file reader object to get directory/zip/directory-nested-in-zip listing
    $this->mfr = new CachedMetadataFileReader(null, $this);
    $this->mfr->rewrite($filename);
    $this->mfr->injectShares($name);
    $this->mfr->processDebugSettings();
    $thumbargs = new \stdClass();
    $thumbargs->{'maxlongest'} = 200;
    $this->mfr->injectArgs($thumbargs);
    // for now just display errors
    if ($this->errbuf !== null) {
      print(implode('', $this->getErrors()));
    }
    if ($this->mfr->isExisting()) {
      if ($this->mfr->isDirectory()) {
        // get the list of entries for this directory
        $listing = $this->mfr->getListing();
        // ensure that we're reading/making up all the metadata (cached and uncached files)
        $this->mfr->getAll($listing, false);
        return $this
          ->render('LightennaStructuredBundle:Fileview:directory.html.twig',
            array(
              'dirname' => $name,
              'direction' => Constantly::DEFAULT_LAYOUT_DIRECTION,
              'celltype' => 'pc',
              'breadth' => Constantly::DEFAULT_LAYOUT_BREADTH,
              'linkpath' => $name == '/' ? '' : trim($name, Constantly::DIR_SEPARATOR_URL) . Constantly::DIR_SEPARATOR_URL,
              'linkaliased' => str_replace(Constantly::DIR_SEPARATOR_URL, Constantly::DIR_SEPARATOR_ALIAS, trim($name, Constantly::DIR_SEPARATOR_URL)) .Constantly::DIR_SEPARATOR_ALIAS,
              'argsbase' => Constantly::ARG_SEPARATOR,
              'argsdefault' => 'maxlongest='.$thumbargs->{'maxlongest'}.'&',
              'dirlisting' => $listing,
              'metaform' => $this->mfr->getMetadata()->getForm($this)->createView(),
              'defaults' => ImageMetadata::getDefaults(),
              // client-side settings
              'settings' => $this->settings['client'],
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


