<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\HttpFoundation\RedirectResponse;

use Lightenna\StructuredBundle\Entity\ImageMetadata;
use Lightenna\StructuredBundle\Entity\Arguments;
use Lightenna\StructuredBundle\DependencyInjection\LayerOuter;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;

class FileviewController extends ViewController
{

    public function indexAction($rawname, $format = 'html', Request $req)
    {
        $this->request = $req;
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
        $thumbargs = new Arguments(200,200);
        $this->mfr->mergeArgs($thumbargs);
        // for now just display errors
        if ($this->errbuf !== null) {
            print(implode('', $this->getErrors()));
        }
        if ($this->mfr->isExisting()) {
            if ($this->mfr->isDirectory()) {
                // get the list of entries for this directory
                $listing = $this->mfr->getListing();
                $linkpath = $name == '/' ? '' : trim($name, Constantly::DIR_SEPARATOR_URL) . Constantly::DIR_SEPARATOR_URL;
                // check to see if we've only got a single entry
                if (count($listing) == 1) {
                    if ($listing[0]->isDirectory()) {
                        // if it's a directory, redirect to it immediately
                        return new RedirectResponse('/file/'. $linkpath . $listing[0]->getName() . Constantly::DIR_SEPARATOR_URL);
                    }
                }
                // ensure that we're reading/making up all the metadata (cached and uncached files)
                $this->mfr->getDirectoryAll($listing, false);
                return $this
                    ->render('LightennaStructuredBundle:Fileview:directory.html.twig',
                        array(
                            'dirname' => $name,
                            'direction' => Constantly::DEFAULT_LAYOUT_DIRECTION,
                            'celltype' => 'pc',
                            'breadth' => Constantly::DEFAULT_LAYOUT_BREADTH,
                            'linkpath' => $linkpath,
                            'linkaliased' => str_replace(Constantly::DIR_SEPARATOR_URL, Constantly::DIR_SEPARATOR_ALIAS, trim($name, Constantly::DIR_SEPARATOR_URL)) . Constantly::DIR_SEPARATOR_ALIAS,
                            'dirsep' => Constantly::DIR_SEPARATOR_ALIAS,
                            'argsbase' => Constantly::ARG_SEPARATOR,
                            'dirlisting' => $listing,
                            'metaform' => $this->mfr->getMetadata()->getForm($this)->createView(),
                            'defaults' => ImageMetadata::getDefaults(),
                            // client-side settings
                            'settings' => $this->settings['client'],
                        ));
            } else {
                // prepare BinaryFileResponse
                $realname = str_replace('/', '\\', $filename);
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


