<?php

/**
 * deprecated approach
 * preserved here to archive in VCS
 */

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse; 
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;
 
use Lightenna\StructuredBundle\DependencyInjection\Metadata;
use Lightenna\StructuredBundle\DependencyInjection\FileReader;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolverInterface;
 
class MetadataPostType extends AbstractType {

  /**
   * compose form
   */
  public function buildForm( FormBuilderInterface $builder, array $options ) {
    $builder->add('headline', 'text');
    $builder->add('byline', 'text');
    $builder->add('caption', 'textarea');
    $builder->add('keywords', 'text');
    $builder->add('copyright', 'text');
    $builder->add('source', 'text');
  }

  public function setDefaultOptions(OptionsResolverInterface $resolver)
  {
    $resolver->setDefaults(array(
      'validation_groups' => false,
    ));
  }

  public function getName() {
    return 'MetadataPostType';
  }
}

class MetadataPostController extends Controller
{
  /**

lightenna_structured_temppost:
    path:      /post/
    defaults:  { _controller: LightennaStructuredBundle:MetadataPost:create }
    requirements:
        rawname:  ".*"

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

  /**
   * remove, doesn't work
   */
  public function setDefaultOptions(OptionsResolverInterface $resolver)
  {
    $resolver->setDefaults(array(
      'validation_groups' => false,
    ));
  }

}
