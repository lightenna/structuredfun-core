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
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;

class LayoutviewController extends ViewController {

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
        $dirmeta = $this->mfr->skimListing($this->mfr->getListing());
        // return new JsonResponse($this->serialise($dirmeta));
        echo($this->serialise($dirmeta));
        exit;
      }
    } else {
      // implied else
      return $this->render('LightennaStructuredBundle:Fileview:file_not_found.html.twig');
    }
  }

  private function serialise($dirmeta) {
    $encoders = array(new XmlEncoder(), new JsonEncoder());
    $normalizers = array(new GetSetMethodNormalizer());
    $igFields = array_merge(ImageMetadata::getIgnoredAttributes(), GenericEntry::getIgnoredAttributes());
    $normalizers[0]->setIgnoredAttributes($igFields);
    $serializer = new Serializer($normalizers, $encoders);
    $jsonContent = $serializer->serialize($dirmeta, 'json');
    return $jsonContent;
  }

}
