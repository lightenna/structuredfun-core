<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse; 
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;
 
use Lightenna\StructuredBundle\DependencyInjection\Metadata;
use Lightenna\StructuredBundle\DependencyInjection\MetadataPostType;
use Lightenna\StructuredBundle\DependencyInjection\FileReader;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;

class MetadataPostController extends Controller
{
  /**
   * @todo start with this is its own controller, then merge into imagemeta later
   * @Route( "/post/new", name="create_post" )
   * @Template()
   */
  public function createAction( Request $request )
  {
    $postform = $this->createForm(new MetadataPostType());
    if ( $request->isMethod( 'POST' ) ) {
      $postform->submit( $request );
      if ( $postform->isValid( ) ) {
        /*
         * $data['title']
         * $data['body']
         */
        $data = $postform->getData();
        $response['data'] = $data;
        $response['success'] = true;
      } else {
        $response['success'] = false;
        $response['cause'] = 'whatever';
      }
      return new JsonResponse( $response );
    } else {
      return $this->render('LightennaStructuredBundle:Fileview:partial.metaform.html.twig', array(
          'postform' => $postform->createView(),
      ));
	  }
  }
}
