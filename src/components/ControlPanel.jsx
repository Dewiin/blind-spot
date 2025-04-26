export function ControlPanel( {describeScene} ) {
    return (
        <div className='control-panel' onClick={() => {describeScene()}} />
    )
}