<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

use Symfony\Component\Serializer\Serializer;
use Symfony\Component\Serializer\Encoder\XmlEncoder;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\GetSetMethodNormalizer;

use Lightenna\StructuredBundle\Entity\ImageMetadata;
use Lightenna\StructuredBundle\Entity\GenericEntry;
use Lightenna\StructuredBundle\DependencyInjection\LayerOuter;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;

/**
 * Notes:
 * layout view lays out cells rather than images
 * for most cells, the image will fill the cell
 * but if the image is wider than the screen, the cell may contain some black padding
 * this is only likely for b=1 (fullscreen)
 */

class LayoutviewController extends ViewController {

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
    if ($this->mfr->isExisting()) {
      if ($this->mfr->isDirectory()) {
        // get directory metadata (whole), skimming handled in serialise
        $listing = $this->mfr->getListing();
        // ensure that we're reading/making up all the metadata (cached and uncached files)
        $this->mfr->getAll($listing, false);
        $l = new LayerOuter($listing);
        $l->layout(DEFAULT_LAYOUT_BREADTH, DEFAULT_LAYOUT_DIRECTION);
        print($this->serialise($listing));
        exit;
      }
    } else {
      // implied else
      return $this->render('LightennaStructuredBundle:Fileview:file_not_found.html.twig');
    }
  }

  private function serialise($listing) {
    $encoders = array(new XmlEncoder(), new JsonEncoder());
    $normalizers = array(new GetSetMethodNormalizer());
    $igFields = array_merge(ImageMetadata::getIgnoredAttributes(), GenericEntry::getIgnoredAttributes());
    $normalizers[0]->setIgnoredAttributes($igFields);
    $serializer = new Serializer($normalizers, $encoders);
    $jsonContent = $serializer->serialize($listing, 'json');
    return $jsonContent;
  }

}
